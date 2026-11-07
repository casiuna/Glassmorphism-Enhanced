// Real local Komari 1.6.0 + local Agent; traceroute is ALWAYS a local fixture.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  mkdirSync(join(root, 'test-results'), { recursive: true })
  const state = mkdtempSync(join(root, 'test-results/route-lab-'))
  chmodSync(state, 0o700)
  const backend = resolve(root, '../tools/backends/komari-1.6.0')
  const short = 'enhanced-route-probe'
  const reports = []
  let server
  let agent
  let browser
  let cookie = ''
  let seq = 0
  const username = 'route-trial-only'
  const password = `TestA1${randomBytes(24).toString('hex')}`
  const socket = net.createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  const endpoint = `${origin}/api/${short}/v1`
  const isolatedEnv = { PATH: process.env.PATH, HOME: state, TMPDIR: state, LANG: 'C.UTF-8' }
  async function request(path, data, authenticated = true, custom = {}) {
    const response = await fetch(path.startsWith('http') ? path : origin + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { 'Cookie': cookie, 'X-Enhanced-Route': '1' } : {}), ...custom },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    })
    let payload = null
    try {
      payload = await response.json()
    }
    catch { /* Non-JSON is a failed contract, never manufacture a response. */ }
    return { response, payload }
  }
  async function api(path, data) {
    const { response, payload } = await request(path, data)
    assert.equal(response.status, 200, path)
    assert.equal(payload?.status, 'success', path)
    return payload.data
  }
  async function rpc(method, params = {}) {
    const { response, payload } = await request('/api/rpc2', { jsonrpc: '2.0', id: ++seq, method, params })
    assert.equal(response.status, 200, method)
    assert(!payload?.error, `${method}: RPC failure code ${payload?.error?.code ?? 'unknown'}`)
    return payload.result
  }
  async function ready(path, condition = () => true) {
    for (let i = 0; i < 80; i++) {
      try {
        const { response, payload } = await request(path, undefined, false)
        if (response.status === 200 && condition(payload))
          return
      }
      catch { /* Bounded readiness; never converts a failed assertion into pass. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('isolated backend readiness failed')
  }
  function startServer() {
    const log = openSync(join(state, 'backend.log'), 'a', 0o600)
    server = spawn(backend, ['--database', join(state, 'data/komari.db'), '--db-type', 'sqlite', 'server', '--listen', `127.0.0.1:${port}`], { cwd: state, env: isolatedEnv, stdio: ['ignore', log, log] })
  }
  async function stop(child) {
    if (!child || child.exitCode !== null)
      return
    child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) {
      child.kill('SIGKILL')
      await new Promise(resolve => child.once('exit', resolve))
    }
  }
  async function check(name, fn) {
    await fn()
    reports.push({ name, passed: true })
    process.stdout.write(`PASS ${name}\n`)
  }
  async function login() {
    const { response, payload } = await request('/api/login', { username, password }, false)
    assert.equal(payload?.status, 'success', 'isolated login')
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
    assert(cookie, 'isolated session cookie')
  }
  async function configure(uuid, enabled = true) {
    await rpc('admin:setPluginConfiguration', { short, data: { enabled, nodes: JSON.stringify({ [uuid]: { enabled: true, city: 'beijing', periodMinutes: 360 } }) } })
  }
  async function upload(purpose, file) {
    const zip = readFileSync(file)
    const upload = await api('/api/admin/upload/init', { purpose, filename: file.split('/').at(-1), size: zip.length })
    assert(upload.upload_id && upload.chunk_size)
    for (let offset = 0, index = 0; offset < zip.length; offset += upload.chunk_size, index++) {
      const form = new FormData()
      form.append('upload_id', upload.upload_id)
      form.append('chunk_index', String(index))
      form.append('chunk_data', new Blob([zip.subarray(offset, offset + upload.chunk_size)]), 'chunk')
      const response = await fetch(`${origin}/api/admin/upload/chunk`, { method: 'POST', headers: { Cookie: cookie }, body: form, signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, 200)
    }
    await api('/api/admin/upload/merge', { upload_id: upload.upload_id })
  }
  try {
    startServer()
    await ready('/api/install/status')
    await check('fresh isolated installation and exact backend version', async () => {
      assert.equal((await api('/api/install/status')).required, true)
      await api('/api/install/complete', { username, password, sitename: 'Enhanced isolated trial', description: 'Local fixture-only test', metric_dsn: 'sqlite://./data/metrics.db' })
      await ready('/api/version')
      await login()
      assert.equal((await api('/api/version')).version, '1.6.0')
    })
    let client
    let other
    await check('native plugin ZIP upload, identification and permission approval', async () => {
      await upload('plugin', join(root, 'test-results/trial/enhanced-route-probe-0.1.0.zip'))
      await rpc('admin:setPluginEnabled', { short, enabled: true, approved: true })
      assert((await rpc('admin:listPlugins')).some(plugin => plugin.short === short && plugin.enabled))
    })
    await check('sandbox storage and administrator-only result authentication', async () => {
      const health = await request(`${endpoint}/health`)
      assert.equal(health.response.status, 200)
      assert.equal(health.payload?.storage, 'healthy')
      assert.equal((await request(`${endpoint}/snapshot`, undefined, false)).response.status, 403)
      assert.equal((await request(`${endpoint}/poll`, { token: 'invalid-fixture-token' }, false)).response.status, 401)
    })
    await check('isolated client identities; defaults dispatch nothing', async () => {
      const created = await request('/api/admin/client/add', { name: 'Fixture Wendy' })
      const createdOther = await request('/api/admin/client/add', { name: 'Fixture Other' })
      client = created.payload?.data ?? created.payload
      other = createdOther.payload?.data ?? createdOther.payload
      assert(client.uuid && client.token && other.uuid && other.token)
      const poll = await request(`${endpoint}/poll`, { token: client.token }, false)
      assert.equal(poll.response.status, 200)
      assert.equal(poll.payload.state, 'disabled')
      assert.equal(poll.payload.job, null)
    })
    await check('real local Agent, no Ping tasks/SSH/update/external-IP discovery', async () => {
      const file = join(state, 'agent.json')
      writeFileSync(file, JSON.stringify({ 'endpoint': origin, 'token': client.token, 'interval': 1, 'disable-auto-update': true, 'disable-web-ssh': true, 'get-ip-addr-from-nic': true, 'custom-ipv4': '192.0.2.10', 'custom-ipv6': '2001:db8::10' }), { mode: 0o600 })
      const log = openSync(join(state, 'agent.log'), 'a', 0o600)
      agent = spawn(resolve(root, '../tools/backends/komari-agent-1.5.11'), ['--config', file], { cwd: state, env: isolatedEnv, stdio: ['ignore', log, log] })
      for (let i = 0; i < 50; i++) {
        const latest = await rpc('common:getNodesLatestStatus')
        if (latest[client.uuid])
          return
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('local Agent did not report actual metrics')
    })
    await check('official plugin configuration enables only the exact UUID', async () => {
      await configure(client.uuid)
      assert.equal((await rpc('admin:getPluginConfiguration', { short })).data.enabled, true)
    })
    await check('queue rejects arbitrary fields/targets and mismatched city', async () => {
      assert.equal((await request(`${endpoint}/enqueue`, { uuid: client.uuid, city: 'beijing', command: 'never-execute' })).response.status, 400)
      assert.equal((await request(`${endpoint}/enqueue`, { uuid: client.uuid, city: 'example.invalid' })).response.status, 400)
      assert.equal((await request(`${endpoint}/enqueue`, { uuid: client.uuid, city: 'beijing' })).response.status, 200)
    })
    const tokenFile = join(state, 'agent-token')
    const configFile = join(state, 'helper.json')
    writeFileSync(tokenFile, client.token, { mode: 0o600 })
    writeFileSync(configFile, JSON.stringify({ panel: origin, uuid: client.uuid, tokenFile, enabled: true, allowLoopback: true }), { mode: 0o600 })
    const installed = join(state, 'helper-0.1.0')
    await check('helper archive validates and installs into a private versioned prefix', async () => {
      const installedPackage = spawnSync('python3', [join(root, 'tests/companion/install_archive.py'), join(root, 'test-results/trial/enhanced-route-helper-0.1.0.tar.gz'), join(state, 'helper-package'), installed], { encoding: 'utf8' })
      assert.equal(installedPackage.status, 0, 'local archive installer failed')
    })
    const runHelper = () => spawnSync('python3', [join(installed, 'enhanced_route_helper.py'), '--config', configFile, '--once', '--fixture-dir', join(root, 'tests/companion/fixtures')], { encoding: 'utf8' })
    await check('real helper process: fixture -> native Agent identity -> leased result', async () => {
      const run = runHelper()
      assert.equal(run.status, 0, `redacted helper exit ${run.status}`)
      assert.equal(run.stdout.trim(), 'fixture-accepted')
      const snapshot = (await request(`${endpoint}/snapshot`)).payload
      assert.equal(snapshot.nodes[client.uuid].latest.source, 'fixture')
      assert.deepEqual(snapshot.nodes[client.uuid].latest.carriers.telecom.hops[0].asns, [4134])
      assert(!JSON.stringify(snapshot).includes(client.token))
    })
    await check('rename preserves UUID cache without rerunning collection or changing tags', async () => {
      await request(`/api/admin/client/${client.uuid}/edit`, { name: 'Renamed Fixture Wendy', tags: 'USER_KEEP;upstream:Fixture Other' })
      const run = runHelper()
      assert.equal(run.status, 0)
      assert.equal(run.stdout.trim(), 'completed')
      assert((await request(`${endpoint}/snapshot`)).payload.nodes[client.uuid].latest)
    })
    await check('cross-node impersonation, anonymous enqueue and cross-site admin denied', async () => {
      assert.equal((await request(`${endpoint}/result`, { token: other.token, uuid: client.uuid, job_id: 'x', lease: 'x', result: {} }, false)).response.status, 400)
      assert.equal((await request(`${endpoint}/enqueue`, { uuid: client.uuid, city: 'beijing' }, false)).response.status, 403)
      assert.equal((await request(`${endpoint}/snapshot`, undefined, true, { 'Sec-Fetch-Site': 'cross-site' })).response.status, 403)
    })
    const settings = { themeMode: 'light', hideEarth: true, visitorInfoEnabled: false, rpcTransportMode: 'http', dataUpdateInterval: 60, disablePageAnimation: true, returnRoutesVisible: true, returnRouteAutoEnabled: true, returnRouteCompanionEnabled: true, returnRouteTtlHours: 24, transitCarrierPingRules: 'KEEP_RULE', returnRouteConfig: '{"version":1,"nodes":{}}' }
    await check('native theme ZIP upload, activation and managed settings', async () => {
      const hash = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
      await upload('theme', join(root, `komari-theme-Glassmorphism-build-${hash}.zip`))
      await api('/api/admin/theme/set?theme=Enhanced')
      await api('/api/admin/theme/settings?theme=Enhanced', settings)
    })
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const equals = cookie.indexOf('=')
    await context.addCookies([{ name: cookie.slice(0, equals), value: cookie.slice(equals + 1), url: origin }])
    const page = await context.newPage()
    await page.route(url => url.origin !== origin, route => route.abort())
    const node = page.locator(`[data-route-node="${client.uuid}"]`)
    await check('installed theme consumes real authenticated plugin snapshot; fixture is visibly marked', async () => {
      await page.goto(origin)
      await expect(node.locator('[data-return-carrier="telecom"]')).toContainText('163', { timeout: 15000 })
      await expect(node).toContainText('模拟')
      await expect(node.locator('[data-companion-status]')).toContainText('已连接')
      await page.screenshot({ path: join(root, 'test-results/trial/real-1.6.0-fixture-admin.png'), fullPage: true })
    })
    await check('real backend managed-setting save preserves manual priority and unrelated fields', async () => {
      settings.returnRouteConfig = JSON.stringify({ version: 1, nodes: { [client.uuid]: { manual: { telecom: { label: '手动覆盖', updatedAt: new Date().toISOString() } } } } })
      await api('/api/admin/theme/settings?theme=Enhanced', settings)
      await page.reload()
      await expect(node.locator('[data-return-carrier="telecom"]')).toContainText('手动覆盖')
      await expect(node.locator('[data-return-carrier="unicom"]')).toContainText('9929')
      const publicData = await api('/api/public')
      assert.equal(publicData.theme_settings.transitCarrierPingRules, 'KEEP_RULE')
      const actualClient = (await request(`/api/admin/client/${client.uuid}`)).payload
      assert.equal((actualClient.data ?? actualClient).tags, 'USER_KEEP;upstream:Fixture Other')
    })
    await check('TTL expiration via browser clock; manual result does not expire', async () => {
      settings.returnRouteTtlHours = 1
      await api('/api/admin/theme/settings?theme=Enhanced', settings)
      await page.addInitScript(() => {
        const nativeNow = Date.now
        Date.now = () => nativeNow() + 2 * 3600000
      })
      await page.reload()
      await expect(node.locator('[data-return-carrier="telecom"]')).toContainText('手动覆盖')
      await expect(node.locator('[data-return-carrier="unicom"]')).toContainText('已过期')
    })
    await check('anonymous theme keeps manual settings but never fetches private snapshot', async () => {
      const guest = await browser.newPage()
      let privateRequests = 0
      guest.on('request', (request) => {
        if (request.url().includes('/enhanced-route-probe/'))
          privateRequests++
      })
      await guest.goto(origin)
      await expect(guest.locator(`[data-route-node="${client.uuid}"]`)).toContainText('自动结果仅管理员可见')
      assert.equal(privateRequests, 0)
      await guest.close()
    })
    await check('results persist over a real backend restart', async () => {
      await stop(agent)
      await stop(server)
      startServer()
      await ready('/api/version')
      await login()
      assert.equal((await request(`${endpoint}/snapshot`)).payload.nodes[client.uuid].latest.source, 'fixture')
    })
    await check('per-node poll bursts are rate limited', async () => {
      const statuses = []
      for (let i = 0; i < 8; i++)
        statuses.push((await request(`${endpoint}/poll`, { token: client.token }, false)).response.status)
      assert(statuses.includes(429))
    })
    await check('disable stops dispatch; native plugin uninstall removes routes', async () => {
      await configure(client.uuid, false)
      assert.equal((await request(`${endpoint}/poll`, { token: client.token }, false)).payload.state, 'disabled')
      await rpc('admin:setPluginEnabled', { short, enabled: false })
      await rpc('admin:deletePlugin', { short })
      assert(!(await rpc('admin:listPlugins')).some(plugin => plugin.short === short))
      assert.notEqual((await request(`${endpoint}/health`)).response.status, 200)
    })
  }
  catch (error) {
    reports.push({ name: 'integration failure', passed: false, error: String(error.message).slice(0, 300) })
    console.error('FAIL', String(error.message).slice(0, 300))
    process.exitCode = 1
  }
  finally {
    await browser?.close()
    await stop(agent)
    await stop(server)
    const report = { backend: '1.6.0', stateRoot: state, realTracerouteExecuted: false, checks: reports, passed: reports.filter(r => r.passed).length, failed: reports.filter(r => !r.passed).length }
    writeFileSync(join(root, 'test-results/companion-integration.json'), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`INTEGRATION passed=${report.passed} failed=${report.failed}\n`)
  }
}
main().catch(() => {
  console.error('isolated integration setup failed')
  process.exitCode = 1
})
