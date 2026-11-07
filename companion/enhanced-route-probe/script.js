'use strict'
// Route/principal guard pattern adapted from Transit (MIT).
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu. See LICENSE.
// Komari's sandbox uses compatibility module names, not node: imports.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const server = require('server')
const { Coordinator, policy, keys, UUID } = require('./protocol.cjs')
const { ClientRequestLimiter } = require('./request-limits.cjs')
const { Store } = require('./storage.cjs')

const ROOT = '/api/enhanced-route-probe/v1'
const coordinator = new Coordinator(() => crypto.randomBytes(24).toString('hex'))
const limiter = new ClientRequestLimiter()
const storage = new Store(fs, path, typeof __storageDir__ === 'string' ? __storageDir__ : '', coordinator)
storage.restore()

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}
function admin(req) {
  const p = req.context && req.context.principal
  return p && p.type === 'user' && Array.isArray(p.roles) && p.roles.includes('admin')
    && req.headers['x-enhanced-route'] === '1'
    && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
}
function agent(req) {
  const p = req.context && req.context.principal
  return p && p.type === 'agent' && UUID.test(p.client_uuid) ? p.client_uuid : null
}
function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json') || !req.body || req.body.length > 16384)
    throw new TypeError('bounded JSON required')
  return JSON.parse(req.body)
}
function route(method, name, isAdmin, handler) {
  server.route(method, `${ROOT}/${name}`, async (req, res) => {
    const uuid = isAdmin ? null : agent(req)
    if (isAdmin ? !admin(req) : !uuid)
      return json(res, isAdmin ? 403 : 401, { error: 'authentication-required' })
    if (uuid) {
      const retry = limiter.take(uuid, name)
      if (retry) {
        res.setHeader('Retry-After', String(retry))
        return json(res, 429, { error: 'rate-limited' })
      }
    }
    try {
      const config = policy(await server.getConfig())
      if (!storage.healthy)
        storage.save()
      const value = handler(req, uuid, config)
      if (method === 'POST')
        storage.save()
      return json(res, 200, value)
    }
    catch (error) {
      if (!storage.healthy)
        return json(res, 503, { error: 'storage-unavailable' })
      // Never echo raw request bodies, tokens, paths or exceptions into HTTP/logs.
      return json(res, error instanceof SyntaxError || error instanceof TypeError ? 400 : 409, { error: 'invalid-or-conflicting-request' })
    }
  })
}
function load() {
  route('GET', 'snapshot', true, (_req, _uuid, config) => coordinator.snapshot(config))
  route('GET', 'health', true, () => ({ schema: 1, version: '0.1.0', storage: storage.healthy ? 'healthy' : 'unavailable', readAccess: 'admin-only' }))
  route('POST', 'enqueue', true, (req, _uuid, config) => {
    const data = body(req)
    keys(data, ['uuid', 'city'])
    const job = coordinator.enqueue(data.uuid, data.city, config)
    return { queued: true, job_id: job.id }
  })
  route('POST', 'poll', false, (req, uuid, config) => {
    keys(body(req), ['token'])
    return coordinator.poll(uuid, config)
  })
  route('POST', 'result', false, (req, uuid, config) => coordinator.submit(uuid, body(req), config))
}
globalThis.load = load
globalThis.unload = () => storage.save()
