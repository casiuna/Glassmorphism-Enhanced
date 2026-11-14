// REAL isolated Komari 1.6.0, real Full CLI/browser/Agent/helper processes.
// All route collection is fixture-only. Previous theme identities and reload
// faults are explicitly labelled test archives, not historical release binaries.
// When ENHANCED_PREVIOUS_THEME_ZIP is set, its actual pinned release is tested.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const GIGABYTE_LABEL = /GB/
const FORBIDDEN_CARD_RESET_INFO = /下次重置|距离重置|重置倒计时|距重置/
const OPTIONAL_OR_EXEC_METHOD = /^(?:admin|agent)[:.].*(?:[Pp]lugin|[Tt]ask|[Ee]xec)/

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const out = resolve(process.env.ENHANCED_ACCEPTANCE_OUT || join(root, 'test-results/full'))
  mkdirSync(out, { recursive: true })
  const labs = join(root, 'test-results/full')
  mkdirSync(labs, { recursive: true })
  // Keep the SQL fixture's existing strict lab-path guard unchanged.
  const state = mkdtempSync(join(labs, 'native-lab-'))
  chmodSync(state, 0o700)
  const children = []
  const checks = []
  let browser
  let agent
  let server
  let cookie = ''
  let seq = 0
  let activeCheck = 'setup'
  const username = 'full-isolated-trial'
  const password = `UnitA1${randomBytes(24).toString('hex')}`
  const socket = net.createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  const endpoint = '/api/enhanced-route-probe/v1'
  const env = { PATH: process.env.PATH, HOME: state, TMPDIR: state, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' }
  const artifacts = JSON.parse(readFileSync(process.env.ENHANCED_ARTIFACTS_JSON || join(root, 'test-results/release/artifacts.json'), 'utf8'))
  const fullArchive = artifacts.artifacts.find(a => a.kind === 'full-tar-gz').path
  const full = join(state, 'Full')
  const extract = spawnSync('python3', [join(root, 'tests/full/extract_bundle.py'), fullArchive, full], { env, encoding: 'utf8' })
  assert.equal(extract.status, 0, 'extract our verified Full archive')
  const manifest = JSON.parse(readFileSync(join(full, 'full-manifest.json'), 'utf8'))
  const sessionFile = join(state, 'session-private')
  const policyShort = 'enhanced-route-probe'
  const fixtures = join(root, 'tests/companion/fixtures')
  const base = ['--panel', origin, '--allow-loopback-http', ...(manifest.dirty ? ['--allow-development-bundle'] : [])]

  async function request(path, data, authenticated = true, headers = {}) {
    const response = await fetch(origin + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { 'Cookie': cookie, 'X-Enhanced-Route': '1' } : {}), ...headers }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(15000), redirect: 'error' })
    let payload = null
    try {
      payload = await response.json()
    }
    catch { /* A non-JSON native reply fails assertions, never becomes fake data. */ }
    return { response, payload }
  }
  async function api(path, data) {
    const { response, payload } = await request(path, data)
    assert.equal(response.status, 200, 'native REST status')
    assert.equal(payload?.status, 'success', 'native REST envelope')
    return payload.data
  }
  async function rpc(method, params = {}) {
    const { response, payload } = await request('/api/rpc2', { jsonrpc: '2.0', id: ++seq, method, params })
    assert.equal(response.status, 200, 'native RPC HTTP')
    assert(!payload?.error, `native RPC ${method} rejected`)
    return payload.result
  }
  async function upload(kind, path) {
    const data = readFileSync(path)
    const init = await api('/api/admin/upload/init', { purpose: kind, filename: 'isolated-fixture.zip', size: data.length })
    for (let offset = 0, index = 0; offset < data.length; offset += init.chunk_size, index++) {
      const form = new FormData()
      form.append('upload_id', init.upload_id)
      form.append('chunk_index', String(index))
      form.append('chunk_data', new Blob([data.subarray(offset, offset + init.chunk_size)]), 'chunk')
      const response = await fetch(`${origin}/api/admin/upload/chunk`, { method: 'POST', headers: { Cookie: cookie }, body: form })
      assert.equal(response.status, 200)
    }
    await api('/api/admin/upload/merge', { upload_id: init.upload_id })
  }
  async function command(executable, args) {
    return await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { cwd: state, env, stdio: ['ignore', 'pipe', 'pipe'] })
      children.push(child)
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (b) => {
        stdout += b.toString()
        assert(stdout.length < 1048576)
      })
      child.stderr.on('data', (b) => {
        stderr += b.toString()
        assert(stderr.length < 1048576)
      })
      child.once('error', reject)
      child.once('exit', code => resolve({ code, stdout, stderr }))
    })
  }
  async function cli(operation, extra = [], directory = full) {
    const nodeOperation = ['node', 'uninstall-node', 'inspect'].includes(operation)
    const result = await command('python3', [join(directory, 'manage.py'), operation, ...base, ...(!nodeOperation ? ['--session-file', sessionFile] : []), ...extra])
    assert(!result.stdout.includes(password) && !result.stderr.includes(password) && !result.stdout.includes(cookie) && !result.stderr.includes(cookie), 'CLI output redacted')
    return result
  }
  async function check(name, fn) {
    activeCheck = name
    await fn()
    checks.push({ name, passed: true })
    process.stdout.write(`PASS ${name}\n`)
  }
  function start() {
    const log = openSync(join(state, 'backend-private.log'), 'a', 0o600)
    server = spawn(resolve(root, '../tools/backends/komari-1.6.0'), ['--database', join(state, 'data/komari.db'), '--db-type', 'sqlite', 'server', '--listen', `127.0.0.1:${port}`], { cwd: state, env, stdio: ['ignore', log, log] })
    children.push(server)
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
  async function ready(path = '/api/install/status') {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await request(path, undefined, false)).response.status === 200)
          return
      }
      catch { /* Actual bounded readiness, not a blind wait or fabricated response. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('native readiness')
  }
  const config = async () => (await rpc('admin:getPluginConfiguration', { short: policyShort })).data
  const snapshot = async () => (await request(`${endpoint}/snapshot`)).payload
  let client
  let other
  let agentFile
  let formalSettings
  let settingsBeforeUninstall
  let originalState
  let trafficFixture
  let trafficConfig
  const previousTheme = process.env.ENHANCED_PREVIOUS_THEME_ZIP || join(state, 'fixtures/formal-identity-fixture.zip')
  const previousVersion = process.env.ENHANCED_PREVIOUS_THEME_VERSION || '1.1.1'
  let context
  let page
  const prefix = join(state, 'helper-versioned')
  const helperState = join(state, 'node-private')
  try {
    start()
    await ready()
    await check('exact official 1.6.0 fresh isolated installation and private native session', async () => {
      assert.equal((await api('/api/install/status')).required, true)
      await api('/api/install/complete', { username, password, sitename: 'Enhanced Full isolated test', description: 'Fixture-only local QA', metric_dsn: 'sqlite://./data/metrics.db' })
      await ready('/api/version')
      const login = await request('/api/login', { username, password }, false)
      assert.equal(login.payload?.status, 'success')
      cookie = login.response.headers.get('set-cookie').split(';')[0]
      writeFileSync(sessionFile, cookie, { mode: 0o600 })
      assert.equal((await rpc('public:getVersion')).version, '1.6.0')
    })
    await check(`prepare historical plugin source fixture and verify previous Enhanced ${previousVersion} theme identity`, async () => {
      const result = await command('python3', [join(root, 'tests/full/fixture_archives.py'), '--bundle', full, '--output', join(state, 'fixtures')])
      assert.equal(result.code, 0, 'fixture archive preparation')
      if (process.env.ENHANCED_PREVIOUS_THEME_ZIP) {
        const pinned = { '1.1.1': 'ef9aec3d569fe4f9ab7f75393e8079649c17ab31fa53e68669f67fb5153fba68', '1.2.0': 'bc2aeb1810b19800e4dcd9f40ae480021efe3ade16d5b9f752c5568a20e9602e' }
        assert(pinned[previousVersion], 'only a known historical release may be used')
        assert.equal(createHash('sha256').update(readFileSync(previousTheme)).digest('hex'), pinned[previousVersion], 'pinned historical native asset checksum')
      }
      await upload('theme', previousTheme)
      await rpc('admin:editSettings', { theme: 'Enhanced' })
      await api('/api/admin/theme/settings?theme=Enhanced', { unknownFuture: { keep: true }, transitCarrierPingRules: 'PRESERVE_FORMAL', displayCurrency: 'SGD' })
      formalSettings = (await rpc('public:getPublicSettings')).theme_settings
    })
    await check('Full inspection verifies native formats, module versions, dependency matrix and all checksums', async () => {
      const result = await cli('inspect')
      assert.equal(result.code, 0)
      const info = JSON.parse(result.stdout)
      assert.equal(info.commit, manifest.commit)
      assert.equal(info.realTracerouteValidated, false)
    })
    await check('default dry-run and missing approval do not upload or change original theme/configuration', async () => {
      const before = await api('/api/admin/theme/list')
      const run = await cli('install')
      assert.equal(run.code, 0)
      assert.equal(JSON.parse(run.stdout).mode, 'dry-run')
      assert.equal((await cli('install', ['--apply', '--backup-dir', join(state, 'must-not-exist')])).code, 1)
      assert.deepEqual(await api('/api/admin/theme/list'), before)
      assert.equal((await rpc('public:getPublicSettings')).theme, 'Enhanced')
      assert.deepEqual(await rpc('admin:listPlugins'), [])
      assert.equal(existsSync(join(state, 'must-not-exist')), false)
    })
    await check(`ONE CLI upgrades Enhanced ${previousVersion} in place with preserved settings and installs default-off Plugin`, async () => {
      const result = await cli('install', ['--apply', '--approve-route-plugin', '--activate', '--previous-theme', previousTheme, '--backup-dir', join(state, 'install-backup')])
      assert.equal(result.code, 0, `CLI apply failed: ${result.stderr}`)
      assert.equal(JSON.parse(result.stdout).status, 'completed-and-readback-verified')
      assert.equal((await rpc('public:getPublicSettings')).theme, 'Enhanced')
      const themes = await api('/api/admin/theme/list')
      assert(themes.some(t => t.short === 'Enhanced' && t.version === manifest.modules.theme.version))
      assert.equal((await request(`${endpoint}/health`)).payload.version, manifest.modules.plugin.version)
      assert.equal((await config()).enabled, false)
      const upgraded = (await rpc('public:getPublicSettings')).theme_settings
      assert.deepEqual(Object.fromEntries(Object.keys(formalSettings).map(k => [k, upgraded[k]])), formalSettings)
      assert.equal(upgraded.returnRouteAutoEnabled, false)
      assert.equal(upgraded.returnRouteCompanionEnabled, false)
    })
    await check('same-commit reinstall is idempotent with no backup or archive upload', async () => {
      const result = await cli('install', ['--apply', '--approve-route-plugin', '--activate', '--backup-dir', join(state, 'unused-idempotent')])
      assert.equal(result.code, 0)
      assert.equal(JSON.parse(result.stdout).status, 'already-installed; no-writes')
      assert.equal(existsSync(join(state, 'unused-idempotent')), false)
    })
    await check('native local UUID identities; no browser token enrollment or arbitrary remote installation', async () => {
      const one = await request('/api/admin/client/add', { name: 'Full fixture Wendy' })
      const two = await request('/api/admin/client/add', { name: 'Full fixture Other' })
      client = one.payload.data ?? one.payload
      other = two.payload.data ?? two.payload
      assert(client.uuid && client.token && other.uuid && other.token)
      agentFile = join(state, 'authorized-node-agent.json')
      writeFileSync(agentFile, JSON.stringify({ endpoint: origin, token: client.token, interval: 1, disable_auto_update: true, disable_web_ssh: true, get_ip_addr_from_nic: true, custom_ipv4: '192.0.2.10', custom_ipv6: '2001:db8::10' }), { mode: 0o600 })
    })
    const nodeArgs = () => ['--uuid', client.uuid, '--agent-config', agentFile, '--prefix', prefix, '--state-dir', helperState]
    await check('node dry-run never registers, creates code/state, changes Agent file or starts service', async () => {
      const before = readFileSync(agentFile)
      const result = await cli('node', nodeArgs())
      assert.equal(result.code, 0)
      assert.equal(existsSync(prefix), false)
      assert.equal(existsSync(helperState), false)
      assert.deepEqual(readFileSync(agentFile), before)
      assert.equal((await snapshot()).nodes[client.uuid], undefined)
    })
    await check('wrong UUID and unsafe Agent file permissions fail before any node installation', async () => {
      const args = nodeArgs()
      args[1] = other.uuid
      assert.equal((await cli('node', [...args, '--apply'])).code, 1)
      assert.equal(existsSync(prefix), false)
      chmodSync(agentFile, 0o644)
      assert.equal((await cli('node', [...nodeArgs(), '--apply'])).code, 1)
      chmodSync(agentFile, 0o600)
      assert.equal(existsSync(helperState), false)
    })
    await check('one node-local bootstrap registers exact UUID with 0700/0600 storage; does not pretend already online', async () => {
      const before = readFileSync(agentFile)
      const result = await cli('node', [...nodeArgs(), '--apply'])
      assert.equal(result.code, 0, result.stderr)
      assert(!result.stdout.includes(client.token), 'native node credential never logged')
      assert.deepEqual(readFileSync(agentFile), before)
      assert.equal(statSync(helperState).mode & 0o777, 0o700)
      assert.equal(statSync(join(helperState, 'agent-token')).mode & 0o777, 0o600)
      assert.equal(statSync(join(helperState, 'helper.json')).mode & 0o777, 0o600)
      const row = (await snapshot()).nodes[client.uuid]
      assert(row.registeredAt > 0)
      assert.equal(row.seenAt, null)
      assert.equal(row.helperVersion, manifest.modules.helper.version)
      assert.equal(row.latest, null)
    })
    await check('real local Agent metrics remain independent; no SSH, Ping task, updater or external-IP discovery', async () => {
      const log = openSync(join(state, 'agent-private.log'), 'a', 0o600)
      agent = spawn(resolve(root, '../tools/backends/komari-agent-1.5.11'), ['--config', agentFile, '--disable-auto-update', '--disable-web-ssh', '--get-ip-addr-from-nic'], { cwd: state, env, stdio: ['ignore', log, log] })
      children.push(agent)
      for (let i = 0; i < 70; i++) {
        if ((await rpc('common:getNodesLatestStatus'))[client.uuid])
          return
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('local Agent report missing')
    })
    browser = await chromium.launch({ headless: true })
    context = await browser.newContext()
    const equals = cookie.indexOf('=')
    await context.addCookies([{ name: cookie.slice(0, equals), value: cookie.slice(equals + 1), url: origin }])
    page = await context.newPage()
    page.on('pageerror', (error) => {
      const message = error.message
      if (!message.includes(password) && !message.includes(cookie) && !message.includes(client.token))
        console.error(`BROWSER_ERROR ${message.slice(0, 800)}`)
    })
    page.on('response', (response) => {
      if (response.status() >= 400)
        console.error(`BROWSER_HTTP ${response.status()} ${new URL(response.url()).pathname}`)
    })
    await page.route(url => url.origin !== origin, route => route.abort())
    await check('theme-only manual routes persist with Plugin REMOVED and native Agent remote execution disabled', async () => {
      const original = (await rpc('public:getPublicSettings')).theme_settings
      const policy = await config()
      const privateState = (await request(`${endpoint}/checkpoint`)).payload
      const agentBytes = readFileSync(agentFile)
      assert.equal(JSON.parse(agentBytes.toString()).disable_web_ssh, true)
      assert(!privateState.nodes[other.uuid]?.registeredAt, 'the manually edited UUID has no registered Helper')
      await rpc('admin:setPluginEnabled', { short: policyShort, enabled: false })
      await rpc('admin:deletePlugin', { short: policyShort, purge: false })
      assert(!(await rpc('admin:listPlugins')).some(p => p.short === policyShort))
      await api('/api/admin/theme/settings?theme=Enhanced', { ...original, hideEarth: true, visitorInfoEnabled: false, disablePageAnimation: true, returnRoutesVisible: true, returnRouteAutoEnabled: false, returnRouteCompanionEnabled: false })
      let forbidden = 0
      const audit = (r) => {
        if (new URL(r.url()).pathname.startsWith(endpoint))
          forbidden++
        if (r.url().endsWith('/api/rpc2')) {
          const body = r.postDataJSON()
          if (OPTIONAL_OR_EXEC_METHOD.test(body?.method ?? ''))
            forbidden++
        }
      }
      page.on('request', audit)
      await page.goto(origin)
      await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
      await page.getByRole('combobox', { name: '手动线路节点', exact: true }).selectOption(other.uuid)
      for (const [carrier, label] of [['联通', '10099→9929'], ['电信', 'CN2GIA'], ['移动', 'CMIN2']])
        await page.getByRole('textbox', { name: `${carrier}手动线路`, exact: true }).fill(label)
      await page.getByRole('button', { name: '保存本节点手动线路', exact: true }).click()
      await expect(page.locator('[data-manual-route-manager] [role=status]')).toContainText('已保存并读回')
      const saved = (await rpc('public:getPublicSettings')).theme_settings
      assert.equal(JSON.parse(saved.returnRouteConfig).nodes[other.uuid].manual.telecom.label, 'CN2GIA')
      assert.equal(saved.returnRouteAutoEnabled, false)
      assert.equal(saved.returnRouteCompanionEnabled, false)
      for (const [width, mode] of [[1440, 'light'], [320, 'dark']]) {
        await page.setViewportSize({ width, height: 1000 })
        await api('/api/admin/theme/settings?theme=Enhanced', { ...saved, themeMode: mode })
        await page.reload()
        await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
        await page.getByRole('combobox', { name: '手动线路节点', exact: true }).selectOption(other.uuid)
        await expect(page.getByRole('textbox', { name: '电信手动线路', exact: true })).toHaveValue('CN2GIA')
        assert(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1))
        await page.screenshot({ path: join(out, `native-settings-no-plugin-${width}-${mode}.png`), fullPage: true })
        if (width === 1440) {
          await page.getByRole('tab', { name: '外观与背景', exact: true }).click()
          await expect(page.getByRole('checkbox', { name: '显示回程线路', exact: true })).toHaveCount(0)
          await page.screenshot({ path: join(out, 'native-settings-appearance-1440-light.png'), fullPage: true })
          await page.getByRole('tab', { name: '高级设置', exact: true }).click()
          await page.screenshot({ path: join(out, 'native-settings-advanced-1440-light.png'), fullPage: true })
        }
      }
      assert.equal(forbidden, 0, 'manual management must not read Plugin, dispatch tasks or execute commands')
      assert((await rpc('common:getNodesLatestStatus'))[client.uuid], 'normal Agent monitoring remains independent')
      assert.deepEqual(readFileSync(agentFile), agentBytes)
      page.off('request', audit)
      await api('/api/admin/theme/settings?theme=Enhanced', original)
      await upload('plugin', join(full, manifest.modules.plugin.path))
      await rpc('admin:setPluginConfiguration', { short: policyShort, data: policy })
      await rpc('admin:setPluginEnabled', { short: policyShort, enabled: true, approved: true })
      // Native deletePlugin removes its private directory, even with purge=false.
      // Restore our explicit lab setup via the existing admin checkpoint API;
      // this is not a claim that deletion itself preserved private plugin data.
      assert.equal(policy.enabled, false)
      for (const [uuid, node] of Object.entries(privateState.nodes)) {
        const restored = await request(`${endpoint}/restore-node`, { uuid, node })
        assert.equal(restored.response.status, 200)
        assert.equal(restored.payload.restored, true)
      }
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, privateState)
      await page.setViewportSize({ width: 1440, height: 1000 })
    })
    await check('real installed administrator UI detects matching versions and registered-but-not-polling helper', async () => {
      const current = (await rpc('public:getPublicSettings')).theme_settings
      await api('/api/admin/theme/settings?theme=Enhanced', { ...current, hideEarth: true, visitorInfoEnabled: false, disablePageAnimation: true, dataUpdateInterval: 60, themeMode: 'light', unknownFuture: { keep: true }, transitCarrierPingRules: 'KEEP_NATIVE_RELAY', displayCurrency: 'SGD' })
      await page.goto(origin)
      await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
      await page.locator('[data-optional-companion] > summary').click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('[data-enhanced-versions]')).toContainText(manifest.modules.plugin.version)
      await page.getByRole('combobox', { name: '管理节点 UUID', exact: true }).selectOption(client.uuid)
      await expect(page.getByRole('combobox', { name: '管理节点 UUID', exact: true })).toHaveValue(client.uuid)
      await expect(page.locator('[data-helper-status]')).toContainText('已登记，尚未轮询')
    })
    await check('EXPLICIT synthetic metric history is inserted only into the isolated native lab; real RPC is not mocked', async () => {
      await stop(agent)
      // Latest-status delivery is not durable metric-store readiness. Native
      // shutdown flushes its buffered Agent samples; restart the actual backend
      // before reading/seeding its existing tables. Do not fabricate labels or
      // relax seed_traffic_fixture.py's database path/schema prerequisites.
      await stop(server)
      start()
      await ready()
      const seeded = await command('python3', [join(root, 'tests/full/seed_traffic_fixture.py'), '--database', join(state, 'sqlite:/data/metrics.db'), '--node-a', client.uuid, '--node-b', other.uuid])
      assert.equal(seeded.code, 0, seeded.stderr)
      trafficFixture = JSON.parse(seeded.stdout)
      assert.equal(trafficFixture.productionTouched, false)
      assert.equal(trafficFixture.rawCountersCleared, false)
      assert(trafficFixture.insertedRollupRows > 0)
      writeFileSync(join(state, 'traffic-fixture-summary.json'), JSON.stringify(trafficFixture), { mode: 0o600 })
      await rpc('admin:editClient', { uuid: client.uuid, traffic_limit: 1024 ** 4, traffic_limit_type: 'sum' })
      await rpc('admin:editClient', { uuid: other.uuid, traffic_limit: 1024 ** 4, traffic_limit_type: 'sum' })
    })
    await check('five-category native administrator UI persists independent UUID billing days and reads real native traffic sums', async () => {
      await page.getByRole('tab', { name: '节点与卡片', exact: true }).click()
      await expect(page.getByRole('tablist', { name: 'Enhanced 主题设置分类' }).getByRole('tab')).toHaveCount(5)
      for (const [node, day] of [[client, trafficFixture.nodeAResetDay], [other, trafficFixture.nodeBResetDay]]) {
        const row = page.locator(`[data-traffic-cycle-node="${node.uuid}"]`)
        await expect(row.locator('select')).toHaveValue('')
        await expect(row.locator('[data-cycle-used]')).toHaveText('未设置')
        await row.locator('select').selectOption(String(day))
        await row.getByRole('button').click()
        await expect(row.getByRole('status')).toContainText('已保存并读回')
        try {
          await expect(row.locator('[data-cycle-used]')).toHaveText(GIGABYTE_LABEL, { timeout: 15000 })
        }
        catch (error) {
          console.error(`NATIVE_TRAFFIC_STATUS ${(await row.textContent()).slice(0, 1600)}`)
          throw error
        }
      }
      const current = (await rpc('public:getPublicSettings')).theme_settings
      trafficConfig = JSON.parse(current.trafficCycleConfig)
      assert.equal(trafficConfig.nodes[client.uuid].resetDay, trafficFixture.nodeAResetDay)
      assert.equal(trafficConfig.nodes[other.uuid].resetDay, trafficFixture.nodeBResetDay)
      assert.deepEqual(current.unknownFuture, { keep: true })
      assert.equal(current.displayCurrency, 'SGD')
      assert.equal(current.transitCarrierPingRules, 'KEEP_NATIVE_RELAY')
    })
    await check('changing A recalculates only A; B usage, UUID configuration and retained counter history remain unchanged', async () => {
      const rowB = page.locator(`[data-traffic-cycle-node="${other.uuid}"]`)
      const usedB = await rowB.locator('[data-cycle-used]').textContent()
      const rowA = page.locator(`[data-traffic-cycle-node="${client.uuid}"]`)
      await rowA.locator('select').selectOption(String(trafficFixture.changedNodeAResetDay))
      await rowA.getByRole('button').click()
      await expect(rowA.getByRole('status')).toContainText('已保存并读回')
      await expect(rowA.locator('[data-cycle-used]')).toHaveText(GIGABYTE_LABEL)
      await expect(rowB.locator('[data-cycle-used]')).toHaveText(usedB)
      const current = (await rpc('public:getPublicSettings')).theme_settings
      const next = JSON.parse(current.trafficCycleConfig)
      assert.deepEqual(next.nodes[other.uuid], trafficConfig.nodes[other.uuid])
      assert.equal(next.nodes[client.uuid].resetDay, trafficFixture.changedNodeAResetDay)
      trafficConfig = next
      const preserved = await command('python3', [join(root, 'tests/full/seed_traffic_fixture.py'), '--database', join(state, 'sqlite:/data/metrics.db'), '--node-a', client.uuid, '--node-b', other.uuid, '--verify', join(state, 'traffic-fixture-summary.json')])
      assert.equal(preserved.code, 0, preserved.stderr)
      assert.equal(JSON.parse(preserved.stdout).syntheticFixtureHistoryPreserved, true)
    })
    await check('node rename and browser reload preserve managed settings and UUID-linked cycle configuration', async () => {
      await rpc('admin:editClient', { uuid: other.uuid, name: 'Renamed billing fixture B' })
      await page.getByRole('button', { name: '关闭', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
      await page.locator('[data-optional-companion] > summary').click()
      await page.getByRole('tab', { name: '节点与卡片', exact: true }).click()
      const row = page.locator(`[data-traffic-cycle-node="${other.uuid}"]`)
      await expect(row).toContainText('Renamed billing fixture B')
      await expect(row.locator('select')).toHaveValue(String(trafficConfig.nodes[other.uuid].resetDay))
      assert.deepEqual(JSON.parse((await rpc('public:getPublicSettings')).theme_settings.trafficCycleConfig), trafficConfig)
    })
    await check('server-native managed-settings editor remains available without changing saved configuration', async () => {
      const before = (await rpc('public:getPublicSettings')).theme_settings
      await page.goto(`${origin}/admin/theme_managed`)
      await expect(page.getByText('启用公告', { exact: true })).toBeVisible({ timeout: 15000 })
      const nativeText = await page.locator('body').textContent()
      const titles = ['01 · 基础与首页', '02 · 节点与卡片', '03 · 线路与延迟', '04 · 外观与背景', '05 · 高级设置']
      const positions = titles.map(t => nativeText.indexOf(t))
      assert(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])))
      await page.screenshot({ path: join(out, 'native-server-settings-ordered.png'), fullPage: true })
      assert.equal(new URL(page.url()).pathname, '/admin/theme_managed')
      assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, before)
    })
    await check('theme-bundled official compatibility entry bridges to the five tabs without a JSON task', async () => {
      await page.goto(`${origin}/admin-app/index.html?__komari_route=%2Fadmin%2Ftheme_managed`)
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('tab', { name: '节点与卡片', exact: true })).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator(`[data-traffic-cycle-node="${client.uuid}"] select`)).toHaveValue(String(trafficConfig.nodes[client.uuid].resetDay))
    })
    await check('guest cards consume cycle usage without exposing reset dates, countdowns or administrator controls', async () => {
      const guestContext = await browser.newContext()
      const guest = await guestContext.newPage()
      await guest.route(url => url.origin !== origin, route => route.abort())
      await guest.goto(origin)
      const card = guest.getByRole('button', { name: '查看节点 Full fixture Wendy 详情', exact: true })
      await expect(card.locator('[data-machine-traffic]')).toContainText(GIGABYTE_LABEL)
      await expect(card).not.toContainText(FORBIDDEN_CARD_RESET_INFO)
      await expect(guest.getByRole('button', { name: 'Enhanced 管理', exact: true })).toHaveCount(0)
      await guestContext.close()
      await page.getByRole('tab', { name: '线路与延迟', exact: true }).click()
      await page.locator('[data-optional-companion] > summary').click()
      await expect(page.locator('[data-enhanced-versions]')).toBeVisible()
      await page.getByRole('combobox', { name: '管理节点 UUID', exact: true }).selectOption(client.uuid)
    })
    await check('one central form writes selected UUID policy and manual override, preserving other configuration', async () => {
      await page.getByRole('checkbox', { name: '允许全局自动采集', exact: true }).check()
      await page.getByRole('checkbox', { name: '授权当前节点采集', exact: true }).check()
      await page.getByRole('checkbox', { name: '显示并消费回程结果', exact: true }).check()
      await page.getByRole('spinbutton', { name: '回程周期分钟', exact: true }).fill('120')
      await page.getByRole('textbox', { name: '电信手动覆盖', exact: true }).fill('集中手动 & <保留>')
      await page.getByRole('checkbox', { name: '确认当前管理操作', exact: true }).check()
      await page.getByRole('button', { name: '保存当前节点及显示设置', exact: true }).click()
      try {
        await expect(page.getByRole('status')).toContainText('已保存并读取确认', { timeout: 15000 })
      }
      catch (error) {
        console.error(`SAVE_ALERT ${(await page.getByRole('alert').allTextContents()).join(' | ')}`)
        throw error
      }
      const policy = await config()
      assert.deepEqual(JSON.parse(policy.nodes)[client.uuid], { enabled: true, city: 'beijing', periodMinutes: 120 })
      assert.equal(JSON.parse(policy.nodes)[other.uuid], undefined)
      assert.equal(JSON.parse((await rpc('public:getPublicSettings')).theme_settings.returnRouteConfig).nodes[client.uuid].manual.telecom.label, '集中手动 & <保留>')
    })
    await check('native persisted tags, price and approved three-column routes render on desktop/mobile in both themes', async () => {
      const saved = (await rpc('public:getPublicSettings')).theme_settings
      const reply = (await request(`/api/admin/client/${client.uuid}`)).payload
      const oldClient = reply.data ?? reply
      await rpc('admin:editClient', { uuid: client.uuid, tags: 'RELEASE_NATIVE_TAG;upstream:HiddenMetadata', price: 9.9, currency: 'USD', billing_cycle: 30 })
      const routes = JSON.parse(saved.returnRouteConfig)
      routes.nodes[client.uuid].manual = Object.fromEntries(Object.entries({ unicom: '10099→9929', telecom: 'CN2GIA', mobile: 'CMIN2' }).map(([carrier, label]) => [carrier, { label, updatedAt: new Date().toISOString() }]))
      await page.getByRole('button', { name: '关闭', exact: true }).click()
      for (const [width, mode] of [[1440, 'light'], [1440, 'dark'], [320, 'light'], [320, 'dark']]) {
        await api('/api/admin/theme/settings?theme=Enhanced', { ...saved, customTagsVisible: true, nodeCardSize: 'compact', themeMode: mode, returnRouteConfig: JSON.stringify(routes) })
        assert.deepEqual(JSON.parse((await rpc('public:getPublicSettings')).theme_settings.returnRouteConfig), routes)
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(origin)
        const card = page.getByRole('button', { name: '查看节点 Full fixture Wendy 详情', exact: true })
        await expect(card.locator('[data-node-user-tag]')).toHaveText('RELEASE_NATIVE_TAG')
        await expect(card.locator('[data-node-header-meta]')).toContainText('9.9')
        const line = card.locator('[data-route-summary]')
        await expect(line.locator('[data-route-label]')).toHaveText(['10099→9929', 'CN2GIA', 'CMIN2'])
        const layout = await line.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          const columns = Array.from(element.querySelectorAll('[data-return-carrier]'), (cell) => {
            const box = cell.getBoundingClientRect()
            const group = cell.querySelector('[data-route-group]').getBoundingClientRect()
            return { width: box.width, centerError: Math.abs((box.left + box.right - group.left - group.right) / 2) }
          })
          return { display: getComputedStyle(element).display, width: bounds.width, height: bounds.height, columns, overflow: document.documentElement.scrollWidth > window.innerWidth }
        })
        assert.equal(layout.display, 'grid')
        assert.equal(layout.columns.length, 3)
        assert.equal(layout.height, 16)
        assert.equal(layout.overflow, false)
        assert(layout.columns.every(c => Math.abs(c.width - layout.width / 3) <= 0.1 && c.centerError <= 0.1))
        await card.screenshot({ path: join(out, `native-card-${width}-${mode}.png`) })
      }
      await rpc('admin:editClient', { uuid: client.uuid, tags: oldClient.tags, price: oldClient.price, currency: oldClient.currency, billing_cycle: oldClient.billing_cycle })
      await api('/api/admin/theme/settings?theme=Enhanced', saved)
      assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, saved)
      await page.goto(origin)
      await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
      await page.locator('[data-optional-companion] > summary').click()
      await page.getByRole('combobox', { name: '管理节点 UUID', exact: true }).selectOption(client.uuid)
    })
    await check('same bootstrap can explicitly enable foreground Helper: REAL fixture process -> lease -> native authenticated result', async () => {
      const result = await cli('node', [...nodeArgs(), '--apply', '--enable-local', '--run', '--once', '--fixture-dir', fixtures])
      assert.equal(result.code, 0, result.stderr)
      assert(result.stdout.includes('fixture-accepted'))
      assert(!result.stdout.includes(client.token))
      const row = (await snapshot()).nodes[client.uuid]
      assert(row.seenAt > 0)
      assert.equal(row.latest.source, 'fixture')
      assert.equal(row.latest.carriers.telecom.direction, 'node-to-cn')
      await page.getByRole('button', { name: '刷新状态', exact: true }).click()
      await expect(page.locator('[data-helper-status]')).toContainText('Helper 在线')
      await expect(page.locator('[data-helper-status]')).toContainText('模拟 fixture')
    })
    await check('actual UI network error after committed native configuration write restores both original maps', async () => {
      const beforePolicy = await config()
      const beforeSettings = (await rpc('public:getPublicSettings')).theme_settings
      let injected = false
      await page.route('**/api/rpc2', async (route) => {
        const data = route.request().postDataJSON()
        if (!injected && data.method === 'admin:setPluginConfiguration') {
          injected = true
          await route.fetch()
          await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"isolated response failure fixture"}' })
        }
        else {
          await route.continue()
        }
      })
      await page.getByRole('spinbutton', { name: '回程周期分钟', exact: true }).fill('240')
      await page.getByRole('textbox', { name: '电信手动覆盖', exact: true }).fill('MUST_ROLL_BACK')
      await page.getByRole('checkbox', { name: '确认当前管理操作', exact: true }).check()
      await page.getByRole('button', { name: '保存当前节点及显示设置', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('已恢复原有主题与插件配置')
      assert(injected)
      assert.deepEqual(await config(), beforePolicy)
      assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, beforeSettings)
      await page.unroute('**/api/rpc2')
      await page.getByRole('button', { name: '放弃更改并刷新', exact: true }).click()
    })
    for (const [name, width, dark] of [['desktop-light', 1440, false], ['desktop-dark', 1440, true], ['mobile-light', 390, false], ['mobile-dark', 320, true]]) {
      await check(`native centralized management responsive ${name}`, async () => {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark)
        await expect(page.getByRole('dialog')).toBeVisible()
        assert(await page.getByRole('dialog').evaluate(e => e.scrollWidth <= e.clientWidth + 1))
        await page.getByRole('dialog').screenshot({ path: join(out, `${name}.png`) })
      })
    }
    await check('anonymous and cross-site sessions cannot read snapshot/checkpoint or use the manager', async () => {
      const beforeSettings = (await rpc('public:getPublicSettings')).theme_settings
      const deniedWrite = await request('/api/admin/theme/settings?theme=Enhanced', beforeSettings, false)
      assert([401, 403].includes(deniedWrite.response.status), 'native theme settings reject anonymous writes')
      assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, beforeSettings)
      assert.equal((await request(`${endpoint}/checkpoint`, undefined, false)).response.status, 403)
      assert.equal((await request(`${endpoint}/snapshot`, undefined, true, { 'Sec-Fetch-Site': 'cross-site' })).response.status, 403)
      const guest = await browser.newPage()
      let privateRequests = 0
      guest.on('request', (r) => {
        if (r.url().includes('/enhanced-route-probe/'))
          privateRequests++
      })
      await guest.goto(origin)
      await expect(guest.getByRole('button', { name: 'Enhanced 管理', exact: true })).toHaveCount(0)
      const publicLine = guest.locator(`[data-route-node="${client.uuid}"]`)
      await expect(publicLine.locator('[data-return-carrier="telecom"]')).toHaveText('集中手动 & <保留>')
      await expect(publicLine.locator('[data-return-carrier]')).toHaveCount(1)
      await expect(publicLine.locator('summary,pre,time,[data-route-details]')).toHaveCount(0)
      assert.equal(privateRequests, 0)
      await guest.close()
    })
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await check('node rename preserves UUID policy/override/registered result and leaves the Agent config unchanged', async () => {
      const original = readFileSync(agentFile)
      await request(`/api/admin/client/${client.uuid}/edit`, { name: 'Renamed Full fixture Wendy' })
      assert(JSON.parse((await config()).nodes)[client.uuid])
      assert((await snapshot()).nodes[client.uuid].latest)
      await page.reload()
      await expect(page.locator(`[data-route-node="${client.uuid}"] [data-return-carrier="telecom"]`)).toContainText('集中手动 & <保留>')
      assert.deepEqual(readFileSync(agentFile), original)
    })
    await check('unified uninstall captures 0600 private checkpoint BEFORE native removal and preserves formal configuration', async () => {
      originalState = (await request(`${endpoint}/checkpoint`)).payload
      settingsBeforeUninstall = (await rpc('public:getPublicSettings')).theme_settings
      const result = await cli('uninstall', ['--apply', '--approve-route-plugin', '--helpers-stopped', '--backup-dir', join(state, 'uninstall-backup')])
      assert.equal(result.code, 0, result.stderr)
      assert.deepEqual(await rpc('admin:listPlugins'), [])
      assert(!(await api('/api/admin/theme/list')).some(t => t.short === 'Enhanced'))
      const publicData = await rpc('public:getPublicSettings')
      assert.equal(publicData.theme, 'default')
      assert.equal(statSync(join(state, 'uninstall-backup/checkpoint.json')).mode & 0o777, 0o600)
      assert.deepEqual(JSON.parse(readFileSync(join(state, 'uninstall-backup/checkpoint.json'), 'utf8')), originalState)
    })
    await check('uninstall rollback restores real native theme/plugin policy/leases/results and is repeatably idempotent', async () => {
      const args = ['--apply', '--approve-route-plugin', '--backup-dir', join(state, 'uninstall-backup')]
      const run = await cli('rollback', args)
      assert.equal(run.code, 0, run.stderr)
      assert.equal((await rpc('public:getPublicSettings')).theme, 'Enhanced')
      assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, settingsBeforeUninstall)
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, originalState)
      const again = await cli('rollback', args)
      assert.equal(again.code, 0, again.stderr)
      assert.equal(JSON.parse(again.stdout).status, 'already-rolled-back')
    })
    const previousPlugin = join(state, 'fixtures/v120-plugin-source-fixture.zip')
    await check(`v1.2.0 tagged 0.2 plugin source and previous Enhanced ${previousVersion} are detected without touching old state`, async () => {
      await rpc('admin:setPluginEnabled', { short: policyShort, enabled: false })
      const currentPolicy = await config()
      assert(Object.keys(currentPolicy).every(k => ['enabled', 'nodes', 'cdnTargets'].includes(k)))
      if (currentPolicy.cdnTargets !== undefined)
        assert.deepEqual(typeof currentPolicy.cdnTargets === 'string' ? JSON.parse(currentPolicy.cdnTargets) : currentPolicy.cdnTargets, {})
      // Prepare the genuine previous-version configuration alongside its
      // archive. 0.2 must keep rejecting 0.3-only fields; no private state is
      // rewritten and the earlier 0.1 source-upgrade scenario is retained.
      await rpc('admin:setPluginConfiguration', { short: policyShort, data: { enabled: currentPolicy.enabled, nodes: currentPolicy.nodes } })
      await upload('plugin', previousPlugin)
      await rpc('admin:setPluginEnabled', { short: policyShort, enabled: true, approved: true })
      await upload('theme', previousTheme)
      const inspected = await cli('install')
      assert.equal(inspected.code, 0)
      assert(JSON.parse(inspected.stdout).actions.every(a => a.action === 'upgrade'))
      assert.equal((await request(`${endpoint}/snapshot`)).payload.nodes[client.uuid].latest.source, 'fixture')
    })
    await check('missing previous archives fail safely; real native upgrade then preserves both settings and private state', async () => {
      const savedSettings = (await rpc('public:getPublicSettings')).theme_settings
      const missing = await cli('install', ['--apply', '--approve-route-plugin', '--backup-dir', join(state, 'missing-backup')])
      assert.equal(missing.code, 1)
      assert.equal(existsSync(join(state, 'missing-backup')), false)
      const result = await cli('install', ['--apply', '--approve-route-plugin', '--previous-theme', previousTheme, '--previous-plugin', previousPlugin, '--backup-dir', join(state, 'upgrade-backup')])
      assert.equal(result.code, 0, result.stderr)
      assert.deepEqual((await rpc('public:getPublicSettings')).theme_settings, savedSettings)
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, originalState)
    })
    await check('native plugin reload failure after archive overwrite triggers verified version/config/state rollback', async () => {
      const savedPolicy = await config()
      const savedSettings = await rpc('public:getPublicSettings')
      const pluginStates = async () => (await rpc('admin:listPlugins')).map(({ short, version, enabled }) => ({ short, version, enabled }))
      const savedPlugins = await pluginStates()
      const code = join(state, 'data/plugin', policyShort)
      const fileSnapshot = () => Object.fromEntries(readdirSync(code).sort().map((name) => {
        const path = join(code, name)
        assert(lstatSync(path).isFile(), 'plugin code contains only regular files')
        return [name, { sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), mode: statSync(path).mode & 0o777 }]
      }))
      const savedFiles = fileSnapshot()
      const agentBytes = readFileSync(agentFile)
      const marker = join(state, 'data/plugin-data', policyShort, 'enhanced-reload-fault-triggered.json')
      assert.equal(existsSync(marker), false, 'a fresh lab cannot contain a stale fault marker')
      const faultDirectory = join(state, 'fixtures/reload-fault-full')
      const faultManifest = JSON.parse(readFileSync(join(faultDirectory, 'full-manifest.json'), 'utf8'))
      const dryRun = await cli('install', [], faultDirectory)
      assert.equal(dryRun.code, 0)
      const pluginAction = JSON.parse(dryRun.stdout).actions.find(a => a.module === 'plugin')
      assert.equal(pluginAction.action, 'replace-build; ordering-not-inferred')
      const result = await cli('install', ['--apply', '--approve-route-plugin', '--previous-plugin', join(full, manifest.modules.plugin.path), '--backup-dir', join(state, 'native-failure-backup')], faultDirectory)
      assert.equal(result.code, 1)
      assert.equal(existsSync(marker), true, 'actual native plugin script execution MUST precede rollback assertions')
      assert.deepEqual(JSON.parse(readFileSync(marker, 'utf8')), { schema: 1, phase: 'native-plugin-script-load', version: faultManifest.modules.plugin.version, message: 'ENHANCED_FULL_RELOAD_FAULT_TRIGGERED' })
      assert.equal(statSync(marker).mode & 0o777, 0o600)
      assert(!result.stderr.includes('unverified-version-or-downgrade-blocked'))
      assert(result.stderr.includes('rolled-back-and-readback-verified'), result.stderr)
      assert.equal(JSON.parse(readFileSync(join(state, 'native-failure-backup/journal.json'), 'utf8')).status, 'rolled-back')
      assert.equal((await request(`${endpoint}/health`)).payload.version, manifest.modules.plugin.version)
      assert.deepEqual(await pluginStates(), savedPlugins, 'restore native plugin version AND enabled state')
      assert.deepEqual(await rpc('public:getPublicSettings'), savedSettings)
      assert.deepEqual(await config(), savedPolicy)
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, originalState)
      assert.deepEqual(JSON.parse(readFileSync(join(state, 'data/plugin-data', policyShort, 'state-v1.json'), 'utf8')).nodes, originalState.nodes)
      assert.deepEqual(fileSnapshot(), savedFiles, 'restore every native plugin code/manifest/BUILD file and mode')
      assert.deepEqual(readFileSync(agentFile), agentBytes)
      writeFileSync(join(out, 'fault-proof.json'), `${JSON.stringify({ actualScriptLoadTriggered: true, rejectedByVersionGuard: false, faultVersion: faultManifest.modules.plugin.version, restoredVersion: manifest.modules.plugin.version, restoredCodeFiles: Object.keys(savedFiles), enabledStateRestored: true, configRestored: true, privateStateRestored: true, agentUnchanged: true }, null, 2)}\n`)
    })
    await check('native rollback detects and preserves a concurrent administrator policy change', async () => {
      const savedPolicy = await config()
      const nodes = JSON.parse(savedPolicy.nodes)
      nodes[client.uuid].periodMinutes += 60
      const concurrent = { ...savedPolicy, nodes: JSON.stringify(nodes) }
      await rpc('admin:setPluginConfiguration', { short: policyShort, data: concurrent })
      assert.deepEqual(await config(), concurrent)
      const result = await cli('rollback', ['--apply', '--approve-route-plugin', '--backup-dir', join(state, 'native-failure-backup')], join(state, 'fixtures/reload-fault-full'))
      assert.equal(result.code, 1)
      assert(result.stderr.includes('rollback-configuration-conflict; no-overwrite'), result.stderr)
      assert.deepEqual(await config(), concurrent, 'never overwrite the simulated administrator edit')
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, originalState)
      await rpc('admin:setPluginConfiguration', { short: policyShort, data: savedPolicy })
      assert.deepEqual(await config(), savedPolicy, 'restore only our own explicitly injected lab edit')
    })
    await check('private checkpoint, configuration and version survive an actual backend restart', async () => {
      await page.close()
      await stop(server)
      start()
      await ready()
      assert.equal((await request(`${endpoint}/health`)).payload.version, manifest.modules.plugin.version)
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, originalState)
    })
    await check('node code uninstall removes only owned files, retains private rollback material and never touches Agent', async () => {
      const before = readFileSync(agentFile)
      writeFileSync(join(prefix, 'operator-note.txt'), 'retain this file')
      const result = await cli('uninstall-node', ['--prefix', prefix, '--state-dir', helperState, '--apply', '--helpers-stopped'])
      assert.equal(result.code, 0, result.stderr)
      assert.equal(existsSync(join(prefix, 'enhanced_route_helper.py')), false)
      assert.equal(existsSync(join(prefix, 'operator-note.txt')), true)
      assert.equal(existsSync(join(helperState, 'agent-token')), true)
      assert.deepEqual(readFileSync(agentFile), before)
    })
  }
  catch (error) {
  // Avoid assertion object dumps: they could contain ephemeral session values.
    checks.push({ name: activeCheck, passed: false, category: error.name })
    console.error(`FAIL ${activeCheck}: ${error.name}`)
    if (error.message && !error.message.includes(password) && (!cookie || !error.message.includes(cookie)) && (!client || !error.message.includes(client.token)))
      console.error(error.message.slice(0, 1200))
    process.exitCode = 1
  }
  finally {
    await browser?.close()
    for (const child of [...children].reverse())
      await stop(child)
    const result = { kind: 'real-isolated-Komari-1.6.0-Full-CLI-browser-Agent-helper-fixtures', backend: '1.6.0', commit: manifest.commit, dirty: manifest.dirty, fullSHA256: createHash('sha256').update(readFileSync(fullArchive)).digest('hex'), previousThemeOfficialAsset: Boolean(process.env.ENHANCED_PREVIOUS_THEME_ZIP), stateRoot: state, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks, realTracerouteExecuted: false, productionTouched: false, systemServicesStarted: false, childProcessesExited: children.every(c => c.exitCode !== null || c.signalCode !== null) }
    writeFileSync(join(out, 'native-integration.json'), `${JSON.stringify(result, null, 2)}\n`)
    process.stdout.write(`FULL_INTEGRATION passed=${result.passed} failed=${result.failed}\n`)
  }
}
main().catch(() => {
  console.error('FULL_INTEGRATION setup failed; inspect private isolated runtime without exposing credentials')
  process.exitCode = 1
})
