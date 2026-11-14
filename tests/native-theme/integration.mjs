// Real published native ZIPs -> real isolated Komari 1.6.0. No Full/Plugin/Helper.
// Ping uses native Agent TCP tasks against this lab's loopback server only.
// Traffic history is an explicit synthetic SQL fixture, never production data.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const OPTIONAL_OR_EXEC = /^(?:admin|agent)[:.].*(?:[Pp]lugin|[Tt]ask|[Ee]xec)/
const MILLIS = /\d+(?:\.\d+)?\s*ms/
const GB = /GB/
async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const out = resolve(process.env.ENHANCED_THEME_ONLY_OUT || join(root, 'test-results/v121/release-quality-review/native-theme'))
  const downloads = JSON.parse(readFileSync(process.env.ENHANCED_THEME_ONLY_ASSETS || join(root, 'test-results/native-theme-assets/download-verification.json'), 'utf8'))
  const published = version => downloads.find(a => a.version === version && a.name.endsWith('.zip'))
  const current = published('v1.2.1')
  const previous = published('v1.2.0')
  for (const a of [current, previous]) {
    assert(a && a.url.startsWith('https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/'))
    assert.equal(createHash('sha256').update(readFileSync(a.path)).digest('hex'), a.sha256)
  }
  mkdirSync(out, { recursive: true, mode: 0o700 })
  const results = []
  for (const mode of ['fresh', 'upgrade']) {
    const labs = join(root, 'test-results/full')
    mkdirSync(labs, { recursive: true })
    const state = mkdtempSync(join(labs, `native-lab-theme-only-${mode}-`))
    chmodSync(state, 0o700)
    const children = []
    const checks = []
    let server
    let browser
    let agents = []
    let cookie = ''
    let seq = 0
    let active = 'setup'
    let forbidden = 0
    const username = 'isolated-theme-only-admin'
    const password = `TrialA1${randomBytes(24).toString('hex')}`
    const env = { PATH: process.env.PATH, HOME: state, TMPDIR: state, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' }
    const socket = net.createServer()
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    const origin = `http://127.0.0.1:${port}`
    async function request(path, data, authenticated = true) {
      const response = await fetch(origin + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(15000), redirect: 'error' })
      const payload = await response.json()
      return { response, payload }
    }
    async function api(path, data) {
      const r = await request(path, data)
      assert.equal(r.response.status, 200)
      assert.equal(r.payload.status, 'success')
      return r.payload.data
    }
    async function rpc(method, params = {}) {
      const r = await request('/api/rpc2', { jsonrpc: '2.0', id: ++seq, method, params })
      assert.equal(r.response.status, 200)
      assert(!r.payload.error, `native RPC rejected ${method}`)
      return r.payload.result
    }
    function start() {
      const log = openSync(join(state, 'server-private.log'), 'a', 0o600)
      server = spawn(resolve(root, '../tools/backends/komari-1.6.0'), ['--database', join(state, 'data/komari.db'), '--db-type', 'sqlite', 'server', '--listen', `127.0.0.1:${port}`], { cwd: state, env, stdio: ['ignore', log, log] })
      children.push(server)
    }
    async function stop(p) {
      if (!p || p.exitCode !== null || p.signalCode !== null)
        return
      p.kill('SIGTERM')
      await Promise.race([new Promise(resolve => p.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))])
      if (p.exitCode === null && p.signalCode === null) {
        p.kill('SIGKILL')
        await new Promise(resolve => p.once('exit', resolve))
      }
    }
    async function ready(path = '/api/install/status') {
      for (let i = 0; i < 120; i++) {
        try {
          const response = await fetch(origin + path, { signal: AbortSignal.timeout(2000) })
          if (response.status === 200)
            return
        }
        catch { /* Wait only for this newly-created loopback process. */ }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('isolated Komari readiness failed')
    }
    async function check(name, fn) {
      active = name
      await fn()
      checks.push({ name, passed: true })
      process.stdout.write(`PASS ${mode}: ${name}\n`)
    }
    async function upload(path) {
      const data = readFileSync(path)
      const init = await api('/api/admin/upload/init', { purpose: 'theme', filename: 'published-native.zip', size: data.length })
      for (let offset = 0, index = 0; offset < data.length; offset += init.chunk_size, index++) {
        const form = new FormData()
        form.append('upload_id', init.upload_id)
        form.append('chunk_index', String(index))
        form.append('chunk_data', new Blob([data.subarray(offset, offset + init.chunk_size)]), 'chunk')
        const r = await fetch(`${origin}/api/admin/upload/chunk`, { method: 'POST', headers: { Cookie: cookie }, body: form })
        assert.equal(r.status, 200)
      }
      await api('/api/admin/upload/merge', { upload_id: init.upload_id })
    }
    let nodes
    let before
    let fixture
    let agentFiles
    let agentBytes
    try {
      start()
      await ready()
      await check('exact native backend, private session, and zero installed plugins', async () => {
        assert.equal((await api('/api/install/status')).required, true)
        await api('/api/install/complete', { username, password, sitename: 'Native theme-only published asset acceptance', description: 'Isolated loopback QA', metric_dsn: 'sqlite://./data/metrics.db' })
        await ready('/api/version')
        const login = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
        cookie = login.headers.get('set-cookie').split(';')[0]
        assert.equal(login.status, 200)
        assert.equal((await rpc('public:getVersion')).version, '1.6.0')
        assert.deepEqual(await rpc('admin:listPlugins'), [])
        nodes = []
        for (const name of ['Theme-only Relay', 'Theme-only Target']) {
          const r = await request('/api/admin/client/add', { name })
          nodes.push(r.payload.data ?? r.payload)
        }
        assert(nodes.every(n => n.uuid && n.token))
        for (const [i, name] of ['中国联通', '中国电信', '中国移动', 'Relay-Target'].entries()) {
          await rpc('admin:addPingTask', { name, clients: i === 3 ? [nodes[0].uuid] : nodes.map(n => n.uuid), default_on: false, target: `127.0.0.1:${port}`, type: 'tcp', interval: 1 })
        }
        await rpc('admin:editClient', { uuid: nodes[0].uuid, tags: 'THEME_ONLY_TAG;upstream:HiddenMetadata', price: 9.9, currency: 'USD', billing_cycle: 30, traffic_limit: 1024 ** 4, traffic_limit_type: 'sum' })
      })
      await check(mode === 'fresh' ? 'actual published v1.2.1 ZIP uploads and activates without an installer' : 'actual published v1.2.0 ZIP installs as the upgrade source', async () => {
        await upload(mode === 'fresh' ? current.path : previous.path)
        await rpc('admin:editSettings', { theme: 'Enhanced' })
        const active = await rpc('public:getPublicSettings')
        assert.equal(active.theme, 'Enhanced')
        before = { ...active.theme_settings, hideEarth: true, visitorInfoEnabled: false, disablePageAnimation: true, themeMode: 'light', nodeCardSize: 'compact', rpcTransportMode: 'http', hideOfflineNodes: false, returnRoutesVisible: true, returnRouteAutoEnabled: false, returnRouteCompanionEnabled: false, returnRouteTtlHours: 36, transitCarrierPingEnabled: false, transitCarrierPingRules: 'Theme-only Relay|Theme-only Target|Relay-Target', displayCurrency: 'SGD', unknownFuture: { keep: true }, returnRouteConfig: JSON.stringify({ version: 1, nodes: { [nodes[0].uuid]: { manual: { telecom: { label: 'PRESERVED_MANUAL', updatedAt: null } }, auto: {} } } }) }
        await api('/api/admin/theme/settings?theme=Enhanced', before)
        assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, before)
      })
      if (mode === 'upgrade') {
        await check('native in-place v1.2.0 to v1.2.1 upload preserves every prior managed value', async () => {
          await upload(current.path)
          const after = await rpc('public:getPublicSettings')
          assert.equal(after.theme, 'Enhanced')
          for (const [key, value] of Object.entries(before))
            assert.deepEqual(after.theme_settings[key], value, key)
          assert.equal((await api('/api/admin/theme/list')).filter(t => t.short === 'Enhanced').length, 1)
          assert.deepEqual(await rpc('admin:listPlugins'), [])
        })
      }
      await check('real native Agents report metrics and loopback TCP Ping with remote execution disabled', async () => {
        agentFiles = nodes.map((node, i) => {
          const p = join(state, `native-agent-${i}.json`)
          writeFileSync(p, JSON.stringify({ endpoint: origin, token: node.token, interval: 1, disable_auto_update: true, disable_web_ssh: true, get_ip_addr_from_nic: true }), { mode: 0o600 })
          return p
        })
        agentBytes = agentFiles.map(p => readFileSync(p))
        for (const [i, file] of agentFiles.entries()) {
          const log = openSync(join(state, `agent-${i}-private.log`), 'a', 0o600)
          const p = spawn(resolve(root, '../tools/backends/komari-agent-1.5.11'), ['--config', file, '--disable-auto-update', '--disable-web-ssh', '--get-ip-addr-from-nic'], { cwd: state, env, stdio: ['ignore', log, log] })
          children.push(p)
          agents.push(p)
        }
        for (let i = 0; i < 180; i++) {
          const latest = await rpc('common:getNodesLatestStatus')
          const ping = await rpc('public:getPingMetricStats', { entity_id: nodes[0].uuid, hours: 1 })
          if (nodes.every(n => latest[n.uuid]) && ping.stats?.length >= 4)
            return
          await new Promise(resolve => setTimeout(resolve, 250))
        }
        throw new Error('real native metric/Ping report not ready')
      })
      await check('explicit synthetic traffic history is bounded to the isolated lab, not a mocked API', async () => {
        for (const a of agents)
          await stop(a)
        await stop(server)
        start()
        await ready()
        const r = spawnSync('python3', [join(root, 'tests/full/seed_traffic_fixture.py'), '--database', join(state, 'sqlite:/data/metrics.db'), '--node-a', nodes[0].uuid, '--node-b', nodes[1].uuid], { cwd: root, env, encoding: 'utf8' })
        assert.equal(r.status, 0, r.stderr)
        fixture = JSON.parse(r.stdout)
        assert.equal(fixture.productionTouched, false)
        writeFileSync(join(state, 'synthetic-traffic.json'), r.stdout, { mode: 0o600 })
        agents = []
        for (const [i, file] of agentFiles.entries()) {
          const log = openSync(join(state, `agent-${i}-private.log`), 'a', 0o600)
          const p = spawn(resolve(root, '../tools/backends/komari-agent-1.5.11'), ['--config', file, '--disable-auto-update', '--disable-web-ssh', '--get-ip-addr-from-nic'], { cwd: state, env, stdio: ['ignore', log, log] })
          children.push(p)
          agents.push(p)
        }
      })
      browser = await chromium.launch({ headless: true })
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      const eq = cookie.indexOf('=')
      await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: origin }])
      const page = await context.newPage()
      page.on('request', (r) => {
        if (new URL(r.url()).pathname.startsWith('/api/enhanced-route-probe/'))
          forbidden++
        if (r.url().endsWith('/api/rpc2') && OPTIONAL_OR_EXEC.test(r.postDataJSON()?.method ?? ''))
          forbidden++
      })
      await page.route(url => url.origin !== origin, route => route.abort())
      const card = name => page.getByRole('button', { name: `查看节点 ${name} 详情`, exact: true })
      await check('published production bundle renders tags, price, direct three-carrier Ping and administrator entry', async () => {
        await page.goto(origin)
        await expect(card('Theme-only Relay')).toBeVisible()
        await expect(card('Theme-only Relay')).toContainText('THEME_ONLY_TAG')
        await expect(card('Theme-only Relay')).toContainText('9.9')
        for (const carrier of ['unicom', 'telecom', 'mobile'])
          await expect(card('Theme-only Relay').locator(`[data-carrier-ping="${carrier}-latency"]`)).toContainText(MILLIS, { timeout: 20000 })
        await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
        await expect(page.locator('[data-manual-route-manager]')).toBeVisible()
        await expect(page.locator('[data-optional-companion]')).not.toHaveAttribute('open', '')
      })
      await check('theme-only manual inputs save, read back, and persist across real browser reload', async () => {
        await page.getByRole('combobox', { name: '手动线路节点', exact: true }).selectOption(nodes[0].uuid)
        await expect(page.getByRole('textbox', { name: '电信手动线路', exact: true })).toHaveValue('PRESERVED_MANUAL')
        for (const [carrier, name] of [['联通', 'MANUAL_9929'], ['电信', 'MANUAL_CN2'], ['移动', 'MANUAL_CMI']])
          await page.getByRole('textbox', { name: `${carrier}手动线路`, exact: true }).fill(name)
        await page.getByRole('button', { name: '保存本节点手动线路', exact: true }).click()
        await expect(page.locator('[data-manual-route-manager] [role=status]')).toContainText('已保存并读回')
        await page.getByRole('button', { name: '关闭', exact: true }).click()
        await page.reload()
        const line = page.locator(`[data-route-node="${nodes[0].uuid}"]`)
        await expect(line.locator('[data-return-carrier]')).toHaveCount(3)
        await expect(line).toContainText('MANUAL_CN2')
        const saved = (await rpc('public:getPublicSettings')).theme_settings
        assert.deepEqual(saved.unknownFuture, before.unknownFuture)
        assert.equal(saved.returnRouteTtlHours, 36)
        assert.equal(saved.returnRouteAutoEnabled, false)
        assert.equal(saved.returnRouteCompanionEnabled, false)
      })
      await check('native Transit setting saves and renders the real loopback two-leg estimate without a plugin', async () => {
        await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
        await page.getByRole('checkbox', { name: '启用中转三网延迟估算', exact: true }).check()
        await page.getByRole('button', { name: '保存本分类设置', exact: true }).click()
        await expect(page.locator('[data-theme-settings-panel] > [role=status]')).toContainText('已保存并读回')
        await page.getByRole('button', { name: '关闭', exact: true }).click()
        await page.reload()
        for (const carrier of ['unicom', 'telecom', 'mobile'])
          await expect(card('Theme-only Target').locator(`[data-carrier-ping="${carrier}-latency"]`)).toContainText('≈', { timeout: 20000 })
      })
      await check('independent cycle controls save with native metric sums and survive refresh', async () => {
        await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
        await page.getByRole('tab', { name: '节点与卡片', exact: true }).click()
        const row = page.locator(`[data-traffic-cycle-node="${nodes[0].uuid}"]`)
        await row.locator('select').selectOption(String(fixture.nodeAResetDay))
        await row.getByRole('button', { name: '保存 Theme-only Relay 流量周期', exact: true }).click()
        await expect(row.locator('[role=status]')).toContainText('已保存')
        await expect(row.locator('[data-cycle-used]')).toHaveText(GB, { timeout: 15000 })
        const saved = JSON.parse((await rpc('public:getPublicSettings')).theme_settings.trafficCycleConfig)
        assert.equal(saved.nodes[nodes[0].uuid].resetDay, fixture.nodeAResetDay)
        await page.reload()
        await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
        await page.getByRole('tab', { name: '节点与卡片', exact: true }).click()
        await expect(page.locator(`[data-traffic-cycle-node="${nodes[0].uuid}"] select`)).toHaveValue(String(fixture.nodeAResetDay))
        await page.screenshot({ path: join(out, `${mode}-theme-only-settings.png`), fullPage: true })
        await page.getByRole('button', { name: '关闭', exact: true }).click()
        await page.screenshot({ path: join(out, `${mode}-theme-only-home.png`), fullPage: true })
      })
      await check('anonymous access cannot manage or write settings; manual labels remain public', async () => {
        const guest = await browser.newPage()
        await guest.route(url => url.origin !== origin, route => route.abort())
        await guest.goto(origin)
        await expect(guest.getByRole('button', { name: 'Enhanced 管理', exact: true })).toHaveCount(0)
        await expect(guest.locator(`[data-route-node="${nodes[0].uuid}"]`)).toContainText('MANUAL_CN2')
        const current = (await rpc('public:getPublicSettings')).theme_settings
        assert([401, 403].includes((await request('/api/admin/theme/settings?theme=Enhanced', current, false)).response.status))
        assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, current)
        await guest.close()
      })
      await check('zero Plugin/Helper/Full installation and zero optional or execution requests throughout', async () => {
        assert.deepEqual(await rpc('admin:listPlugins'), [])
        assert.equal(forbidden, 0)
        assert(!existsSync(join(state, 'data/plugins/enhanced-route-probe')))
        for (const [i, p] of agentFiles.entries())
          assert.deepEqual(readFileSync(p), agentBytes[i])
        const r = spawnSync('python3', [join(root, 'tests/full/seed_traffic_fixture.py'), '--database', join(state, 'sqlite:/data/metrics.db'), '--node-a', nodes[0].uuid, '--node-b', nodes[1].uuid, '--verify', join(state, 'synthetic-traffic.json')], { cwd: root, env, encoding: 'utf8' })
        assert.equal(r.status, 0, r.stderr)
      })
    }
    catch (error) {
      checks.push({ name: active, passed: false, category: error.name })
      console.error(`FAIL ${mode}: ${active}: ${error.name}`)
      let message = error.message ?? ''
      for (const value of [password, cookie, ...(nodes ?? []).map(n => n.token)]) {
        if (value)
          message = message.replaceAll(value, '[REDACTED]')
      }
      console.error(message.slice(0, 1500))
      process.exitCode = 1
    }
    finally {
      await browser?.close()
      for (const p of [...children].reverse())
        await stop(p)
      const record = { mode, backend: '1.6.0', nativeZIP: current, previousZIP: mode === 'upgrade' ? previous : null, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks, syntheticTrafficFixture: true, pingTargets: 'lab-loopback-only', pluginEverInstalled: false, helperEverInstalled: false, fullInstallerExecuted: false, agentRemoteExecutionDisabled: true, optionalBrowserRequests: forbidden, productionTouched: false, childProcessesExited: children.every(c => c.exitCode !== null || c.signalCode !== null), stateRoot: state }
      results.push(record)
      writeFileSync(join(out, `${mode}.json`), `${JSON.stringify(record, null, 2)}\n`)
    }
    if (process.exitCode)
      break
  }
  const record = { kind: 'REAL_PUBLISHED_NATIVE_THEME_ONLY_KOMARI_1.6.0', passed: results.reduce((n, r) => n + r.passed, 0), failed: results.reduce((n, r) => n + r.failed, 0), scenarios: results, sourceDevServerUsed: false, httpRPCMocked: false, productionTouched: false }
  writeFileSync(join(out, 'native-theme-only.json'), `${JSON.stringify(record, null, 2)}\n`)
  process.stdout.write(`NATIVE_THEME_ONLY passed=${record.passed} failed=${record.failed}\n`)
}
main().catch((error) => {
  console.error(`THEME_ONLY_SETUP_FAILED ${error.name}`)
  process.exitCode = 1
})
