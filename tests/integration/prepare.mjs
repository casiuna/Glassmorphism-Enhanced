// Isolated integration environment only. Never point this at an existing installation.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

async function main() {
  const stateRoot = resolve(process.argv[2] || '../runtime')
  mkdirSync(stateRoot, { recursive: true })

  for (const [version, port] of [['1.6.0', 28760], ['1.5.1', 28510]]) {
    const origin = `http://127.0.0.1:${port}`
    const stateFile = resolve(stateRoot, version, 'test-state.json')
    assert(!existsSync(stateFile), `Refusing to overwrite existing test environment ${stateFile}`)
    const username = 'compatibility-test'
    const password = `TestA1${randomBytes(24).toString('hex')}`
    let cookie = ''
    async function api(path, data) {
      const response = await fetch(`${origin}${path}`, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(30000),
      })
      const payload = await response.json()
      assert.equal(response.status, 200, `${path}: ${JSON.stringify(payload)}`)
      assert.equal(payload.status, 'success', `${path}: ${JSON.stringify(payload)}`)
      if (response.headers.get('set-cookie'))
        cookie = response.headers.get('set-cookie').split(';')[0]
      return payload.data
    }
    const status = await api('/api/install/status')
    assert.equal(status.required, true, 'Only a fresh first-run installation is allowed')
    await api('/api/install/complete', {
      username,
      password,
      sitename: `Isolated Komari ${version}`,
      description: 'Disposable compatibility environment; real official backend and agents',
      metric_dsn: 'sqlite://./data/metrics.db',
    })
    // Bounded startup readiness, no daemon/polling monitor.
    let ready = false
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const actual = await api('/api/version')
        assert.equal(actual.version, version)
        ready = true
        break
      }
      catch {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }
    assert(ready, 'Backend failed to leave first-run mode')
    await api('/api/login', { username, password })
    const me = await fetch(`${origin}/api/me`, { headers: { Cookie: cookie } }).then(r => r.json())
    assert.equal(me.logged_in, true)
    const clients = []
    for (const name of ['RelayNode', 'TargetNode']) {
      const created = await fetch(`${origin}/api/admin/client/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ name }),
      }).then(r => r.json())
      assert.equal(created.status, 'success')
      const uuid = created.uuid ?? created.data?.uuid
      const token = created.token ?? created.data?.token
      assert(uuid && token, 'Missing new client credentials')
      const exact = await fetch(`${origin}/api/admin/client/${uuid}`, { headers: { Cookie: cookie } }).then(r => r.json())
      assert.equal(exact.name ?? exact.data?.name, name)
      clients.push({ name, uuid, token })
    }
    const tasks = []
    for (const [name, target] of [
      ['中国联通', 'www.10010.com:443'],
      ['中国电信', 'www.189.cn:443'],
      ['中国移动', 'www.10086.cn:443'],
      ['Relay-Target', `127.0.0.1:${port}`],
    ]) {
      const response = await api('/api/admin/ping/add', {
        name,
        target,
        type: 'tcp',
        interval: 5,
        default_on: false,
        clients: name === 'Relay-Target' ? [clients[0].uuid] : clients.map(c => c.uuid),
      })
      tasks.push({ name, target, id: response.task_id })
    }
    const persistedTasks = await api('/api/admin/ping/')
    assert.deepEqual(persistedTasks.map(t => t.name).sort(), tasks.map(t => t.name).sort())
    const state = { version, origin, username, password, cookie, clients, tasks }
    writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    chmodSync(stateFile, 0o600)
    for (const client of clients) {
      const config = { 'endpoint': origin, 'token': client.token, 'interval': 2, 'disable-auto-update': true, 'disable-web-ssh': true, 'get-ip-addr-from-nic': true }
      writeFileSync(resolve(stateRoot, version, `${client.name}.json`), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
    }
    process.stdout.write(`${version}: installed, authenticated, ${clients.length} clients and ${tasks.length} persisted real TCP probe tasks; private state saved\n`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
