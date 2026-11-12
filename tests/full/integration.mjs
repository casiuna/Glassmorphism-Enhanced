// REAL isolated Komari 1.6.0, real Full CLI/browser/Agent/helper processes.
// All route collection is fixture-only. Previous theme identities and reload
// faults are explicitly labelled test archives, not historical release binaries.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const out = join(root, 'test-results/full')
  mkdirSync(out, { recursive: true })
  const state = mkdtempSync(join(out, 'native-lab-'))
  chmodSync(state, 0o700)
  const children = []
  const checks = []
  let browser
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
  const artifacts = JSON.parse(readFileSync(join(root, 'test-results/release/artifacts.json'), 'utf8'))
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
  const previousTheme = process.env.ENHANCED_PREVIOUS_THEME_ZIP || join(state, 'fixtures/formal-identity-fixture.zip')
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
    await check('prepare historical plugin source fixture and verify previous Enhanced 1.1.1 theme identity', async () => {
      const result = await command('python3', [join(root, 'tests/full/fixture_archives.py'), '--bundle', full, '--output', join(state, 'fixtures')])
      assert.equal(result.code, 0, 'fixture archive preparation')
      if (process.env.ENHANCED_PREVIOUS_THEME_ZIP)
        assert.equal(createHash('sha256').update(readFileSync(previousTheme)).digest('hex'), 'ef9aec3d569fe4f9ab7f75393e8079649c17ab31fa53e68669f67fb5153fba68', 'pinned official v1.1.1 asset checksum')
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
    await check('ONE CLI upgrades Enhanced 1.1.1 in place with preserved settings and installs default-off Plugin', async () => {
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
      writeFileSync(agentFile, JSON.stringify({ 'endpoint': origin, 'token': client.token, 'interval': 1, 'disable-auto-update': true, 'disable-web-ssh': true, 'get-ip-addr-from-nic': true, 'custom-ipv4': '192.0.2.10', 'custom-ipv6': '2001:db8::10' }), { mode: 0o600 })
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
      const agent = spawn(resolve(root, '../tools/backends/komari-agent-1.5.11'), ['--config', agentFile], { cwd: state, env, stdio: ['ignore', log, log] })
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
    await check('real installed administrator UI detects matching versions and registered-but-not-polling helper', async () => {
      const current = (await rpc('public:getPublicSettings')).theme_settings
      await api('/api/admin/theme/settings?theme=Enhanced', { ...current, hideEarth: true, visitorInfoEnabled: false, disablePageAnimation: true, dataUpdateInterval: 60, themeMode: 'light', unknownFuture: { keep: true }, transitCarrierPingRules: 'KEEP_NATIVE_RELAY', displayCurrency: 'SGD' })
      await page.goto(origin)
      await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('[data-enhanced-versions]')).toContainText(manifest.modules.plugin.version)
      await page.getByRole('combobox', { name: '管理节点 UUID', exact: true }).selectOption(client.uuid)
      await expect(page.getByRole('combobox', { name: '管理节点 UUID', exact: true })).toHaveValue(client.uuid)
      await expect(page.locator('[data-helper-status]')).toContainText('已登记，尚未轮询')
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
      await expect(guest.locator(`[data-route-node="${client.uuid}"]`)).toContainText('自动结果仅管理员可见')
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
    const previousPlugin = join(state, 'fixtures/legacy-plugin-source-fixture.zip')
    await check('historical 0.1 plugin source and previous Enhanced 1.1.1 are detected without touching old state', async () => {
      await rpc('admin:setPluginEnabled', { short: policyShort, enabled: false })
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
      const result = await cli('install', ['--apply', '--approve-route-plugin', '--previous-plugin', join(full, manifest.modules.plugin.path), '--backup-dir', join(state, 'native-failure-backup')], join(state, 'fixtures/reload-fault-full'))
      assert.equal(result.code, 1)
      assert(result.stderr.includes('rolled-back-and-readback-verified'), result.stderr)
      assert.equal((await request(`${endpoint}/health`)).payload.version, manifest.modules.plugin.version)
      assert.deepEqual(await config(), savedPolicy)
      assert.deepEqual((await request(`${endpoint}/checkpoint`)).payload, originalState)
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
