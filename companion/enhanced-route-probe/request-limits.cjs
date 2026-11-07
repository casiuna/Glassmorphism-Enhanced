'use strict'
// Token-bucket design adapted from Transit request-limits.cjs (MIT).
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu. See LICENSE.
class ClientRequestLimiter {
  constructor(now = Date.now) {
    this.now = now
    this.clients = new Map()
  }

  take(client, kind) {
    const now = this.now()
    for (const [key, value] of this.clients) {
      if (now - value.seenAt >= 600000)
        this.clients.delete(key)
    }
    let state = this.clients.get(client)
    if (!state) {
      if (this.clients.size >= 500)
        return 60
      state = { seenAt: now }
      this.clients.set(client, state)
    }
    state.seenAt = now
    const capacity = kind === 'poll' ? 6 : 8
    const interval = kind === 'poll' ? 5000 : 15000
    const bucket = state[kind] || { tokens: capacity, at: now }
    bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0, now - bucket.at) / interval)
    bucket.at = now
    state[kind] = bucket
    if (bucket.tokens < 1)
      return Math.max(1, Math.ceil((1 - bucket.tokens) * interval / 1000))
    bucket.tokens -= 1
    return 0
  }
}
module.exports = { ClientRequestLimiter }
