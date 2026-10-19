// Real backend integration: requires freshly prepared loopback instances and official agents.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

// Node's native WebSocket omits Origin; emulate the browser's same-origin
// handshake without disabling or weakening the real backend origin check.
const NativeWebSocket = globalThis.WebSocket
const WS_PROTOCOL_REGEX = /^ws/
const REMOVED_API_REGEX = /notification|terminal/i
const ABORTED_REGEX = /aborted/
globalThis.WebSocket = class extends NativeWebSocket {
  constructor(url) {
    super(url, { headers: { Origin: new URL(url).origin.replace(WS_PROTOCOL_REGEX, 'http') } })
  }
}

async function main() {
  const [stateArg, oldZipArg, newZipArg, reportArg] = process.argv.slice(2)
  assert(stateArg && oldZipArg && newZipArg && reportArg, 'Usage: node tests/integration/verify.mjs STATE_ROOT OLD_ZIP CANDIDATE_ZIP REPORT_JSON')
  const results = []
  function record(version, name, detail = {}) {
    results.push({ version, name, status: 'passed', ...detail })
    process.stdout.write(`PASS ${version} ${name}\n`)
  }
  const vite = await createServer({
    configFile: false,
    resolve: { alias: { '@': resolve('src') } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
  })
  const { RpcClient, KomariRpc } = await vite.ssrLoadModule('/src/utils/rpc.ts')
  const browser = await chromium.launch({ headless: true })
  try {
    for (const version of ['1.6.0', '1.5.1']) {
      const state = JSON.parse(readFileSync(resolve(stateArg, version, 'test-state.json'), 'utf8'))
      const { origin, cookie } = state
      assert.equal(new URL(origin).hostname, '127.0.0.1', 'Only isolated loopback instances are allowed')
      async function api(path, data) {
        const response = await fetch(`${origin}${path}`, {
          method: data === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
          body: data === undefined ? undefined : JSON.stringify(data),
          signal: AbortSignal.timeout(30000),
        })
        const json = await response.json()
        assert.equal(response.status, 200, `${path}: ${JSON.stringify(json)}`)
        assert.equal(json.status, 'success', `${path}: ${JSON.stringify(json)}`)
        return json.data
      }
      assert.equal((await api('/api/version')).version, version)
      const me = await fetch(`${origin}/api/me`, { headers: { Cookie: cookie } }).then(r => r.json())
      assert.equal(me.logged_in, true)
      if (version === '1.5.1') {
        await api('/api/admin/settings', { visitor_audit_enabled: false })
        assert.equal((await api('/api/public')).visitor_audit_enabled, false)
      }
      record(version, 'official backend version and verified native session')

      const rpc = new KomariRpc({ baseUrl: `${origin}/api/rpc2`, timeout: 10000 })
      const nodes = await rpc.getNodes()
      const statuses = await rpc.getNodesLatestStatus()
      for (const client of state.clients) {
        assert.equal(nodes[client.uuid].name, client.name)
        const status = statuses[client.uuid]
        assert(status, 'Official agent must provide actual status')
        for (const field of ['cpu', 'ram', 'disk', 'net_in', 'net_out', 'net_total_up', 'net_total_down'])
          assert(Number.isFinite(status[field]), `Missing actual ${field}`)
        assert(status.ram > 0 && status.disk > 0)
        const history = await rpc.getLoadRecords(client.uuid, 1)
        const rows = Array.isArray(history.records) ? history.records : history.records[client.uuid]
        assert(rows?.length > 0, 'Real load history must be persisted')
      }
      record(version, 'real agent node metrics, machine counters and persisted load history', { nodes: state.clients.length, gpuHardware: 'physical GPU metrics not exercised; host exposes a virtio display only' })

      const tasks = await rpc.getPublicPingTasks()
      assert.equal(tasks.length, 4)
      const ping = await rpc.getPingRecords(undefined, 1, undefined, undefined, state.clients[0].uuid)
      assert(ping.records.length > 0)
      const raw = await rpc.getPublicPingRecords({ uuid: state.clients[0].uuid, hours: 1 })
      const stats = await rpc.getPublicPingMetricStats({ uuid: state.clients[0].uuid, hours: 1 })
      const taskCounts = {}
      for (const task of state.tasks) {
        const rows = raw.records.filter(r => Number(r.task_id) === task.id)
        assert(rows.length > 0, `Real probe history missing ${task.name}`)
        assert(rows.every(r => Number.isFinite(r.value)))
        const stat = stats.stats.find(s => Number(s.task_id) === task.id)
        assert(stat && stat.total > 0)
        assert(stat.loss >= 0 && stat.loss <= 100)
        taskCounts[task.name] = { samples: rows.length, losses: rows.filter(r => r.value < 0).length, loss: stat.loss }
      }
      record(version, 'three carrier TCP probes, latency/loss/history and Relay-Target task', { taskCounts })

      const transport = new RpcClient({ baseUrl: `${origin}/api/rpc2`, useWebSocket: true, timeout: 10000 })
      try {
        await transport.ensureWebSocketConnectedWithPing()
        assert.equal(await transport.call('rpc.ping'), 'pong')
        const publicInfo = await transport.call('public:getPublicSettings')
        assert.equal(Object.hasOwn(publicInfo, 'visitor_audit_enabled'), version === '1.5.1')
        if (version === '1.5.1')
          assert.equal(publicInfo.visitor_audit_enabled, false)
        const ws = transport.getWebSocket()
        await new Promise((resolve) => {
          ws.addEventListener('close', resolve, { once: true })
          ws.close()
        })
        await transport.ensureWebSocketConnectedWithPing()
        assert.equal((await transport.call('public:getVersion')).version, version)
        await assert.rejects(transport.call('public:deliberatelyMissingCompatibilityMethod'), error => error.code === -32601)
        assert.equal(await transport.call('rpc.ping'), 'pong')
        const controller = new AbortController()
        controller.abort()
        await assert.rejects(transport.call('rpc.ping', undefined, controller.signal), ABORTED_REGEX)
        record(version, 'theme RPC SDK WebSocket heartbeat, reconnect, explicit errors and abort recovery')
      }
      finally { transport.close() }

      async function upload(zipPath, short, expectedVersion) {
        const bytes = readFileSync(zipPath)
        const session = await api('/api/admin/upload/init', { purpose: 'theme', filename: `${short}.zip`, size: bytes.length })
        for (let start = 0, index = 0; start < bytes.length; start += session.chunk_size, index++) {
          const form = new FormData()
          form.set('upload_id', session.upload_id)
          form.set('chunk_index', String(index))
          form.set('chunk_data', new Blob([bytes.subarray(start, start + session.chunk_size)]), `chunk-${index}`)
          const response = await fetch(`${origin}/api/admin/upload/chunk`, { method: 'POST', headers: { Cookie: cookie }, body: form })
          assert.equal((await response.json()).status, 'success')
        }
        const installed = await api('/api/admin/upload/merge', { upload_id: session.upload_id })
        assert.equal(installed.short, short)
        const manifest = await fetch(`${origin}/themes/${short}/komari-theme.json`).then(r => r.json())
        assert.equal(manifest.short, short)
        assert.equal(manifest.version, expectedVersion)
        return createHash('sha256').update(bytes).digest('hex')
      }
      await upload(oldZipArg, 'Glassmorphism', '1.0.8')
      const candidateSha256 = await upload(newZipArg, 'Enhanced', '1.1.0')
      const installed = await api('/api/admin/theme/list')
      assert(installed.some(t => t.short === 'Glassmorphism'))
      assert(installed.some(t => t.short === 'Enhanced'))
      record(version, 'official chunked ZIP installation with both identities retained', { candidateSha256 })

      const original = {
        hideEarth: true,
        visitorInfoEnabled: false,
        themeMode: 'light',
        rpcTransportMode: 'http',
        dataUpdateInterval: 1,
        nodeCardSize: 'compact',
        transitCarrierPingEnabled: true,
        transitCarrierPingRules: 'RelayNode|TargetNode|Relay-Target',
      }
      await api('/api/admin/theme/settings?theme=Glassmorphism', original)
      await api('/api/admin/theme/set?theme=Glassmorphism')
      const oldPublic = await api('/api/public')
      assert.equal(oldPublic.theme, 'Glassmorphism')
      for (const [key, value] of Object.entries(original))
        assert.equal(oldPublic.theme_settings[key], value)
      await api('/api/admin/theme/settings?theme=Enhanced', oldPublic.theme_settings)
      await api('/api/admin/theme/set?theme=Enhanced')
      const newPublic = await api('/api/public')
      assert.equal(newPublic.theme, 'Enhanced')
      assert.deepEqual(newPublic.theme_settings, oldPublic.theme_settings)
      await api('/api/admin/theme/set?theme=Glassmorphism')
      assert.deepEqual((await api('/api/public')).theme_settings, oldPublic.theme_settings)
      await api('/api/admin/theme/set?theme=Enhanced')
      assert.equal((await api('/api/public')).theme, 'Enhanced')
      record(version, 'explicit settings copy, identity switch and non-destructive rollback')

      for (const mode of ['http', 'websocket']) {
        await api('/api/admin/theme/settings?theme=Enhanced', { ...oldPublic.theme_settings, rpcTransportMode: mode })
        assert.equal((await api('/api/public')).theme_settings.rpcTransportMode, mode)
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
        await context.addCookies([{ name: 'session_token', value: cookie.slice('session_token='.length), url: origin }])
        const page = await context.newPage()
        const errors = []
        const methods = []
        page.on('pageerror', e => errors.push(e.message))
        page.on('request', (request) => {
          if (request.method() === 'POST' && request.url().endsWith('/api/rpc2')) {
            const body = request.postDataJSON()
            methods.push(body?.method)
          }
        })
        page.on('websocket', socket => socket.on('framesent', (event) => {
          try {
            methods.push(JSON.parse(String(event.payload)).method)
          }
          catch { /* /api/clients uses a non-JSON get frame. */ }
        }))
        await page.goto(origin, { waitUntil: 'networkidle' })
        const relay = page.getByRole('button', { name: '查看节点 RelayNode 详情', exact: true })
        await relay.waitFor({ state: 'visible' })
        assert(await relay.locator('[data-machine-traffic]').count() > 0)
        assert((await page.locator('body').textContent()).includes('TargetNode'))
        await relay.click()
        await page.locator('.instance-detail').waitFor({ state: 'visible' })
        // Exercise the real history/chart load, without API mocks or fabricated rows.
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 })
        await page.getByRole('button', { name: '返回首页', exact: true }).click()
        await relay.waitFor({ state: 'visible' })
        await page.getByRole('button', { name: '显示首页工具', exact: true }).click()
        await page.getByRole('button', { name: '日志：管理员操作审计日志', exact: true }).click()
        await page.getByText('日志列表', { exact: true }).waitFor({ state: 'visible' })
        if (version === '1.6.0') {
          await page.getByText('当前核心未提供访客审计接口（Komari 1.6.0 已移除）；不采集访客事件，普通管理日志仍可查看。', { exact: true }).waitFor({ state: 'visible' })
          assert.equal(await page.getByRole('tab', { name: '访客安全', exact: true }).isDisabled(), true)
          assert.equal(await page.getByRole('button', { name: '启用采集', exact: true }).count(), 0)
          assert(!methods.includes('public:recordVisitorEvent'))
        }
        else if (mode === 'http') {
          await page.getByRole('button', { name: '启用采集', exact: true }).click()
          await page.getByRole('button', { name: '暂停采集', exact: true }).waitFor({ state: 'visible' })
          assert.equal((await api('/api/public')).visitor_audit_enabled, true)
          const [submission] = await Promise.all([
            page.waitForResponse(response => response.url().endsWith('/api/rpc2') && response.request().postDataJSON()?.method === 'public:recordVisitorEvent'),
            page.getByRole('button', { name: '刷新', exact: true }).click(),
          ])
          const result = await submission.json()
          assert.equal(result.result?.status, 'success')
          await page.getByRole('button', { name: '暂停采集', exact: true }).click()
          await page.getByRole('button', { name: '启用采集', exact: true }).waitFor({ state: 'visible' })
          assert.equal((await api('/api/public')).visitor_audit_enabled, false)
        }
        assert(!methods.some(m => REMOVED_API_REGEX.test(m || '')))
        assert.deepEqual(errors, [])
        await page.screenshot({ path: resolve(reportArg, '..', `real-${version}-${mode}.png`), fullPage: true })
        record(version, `installed theme real browser ${mode}: home/detail/home, charts, counters, no removed RPC or page errors`, { rpcMethods: [...new Set(methods.filter(Boolean))] })
        await context.close()
      }
      rpc.close()
    }
  }
  catch (error) {
    results.push({ status: 'failed', error: error.stack })
    throw error
  }
  finally {
    writeFileSync(reportArg, `${JSON.stringify({ results }, null, 2)}\n`)
    await browser.close()
    await vite.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
