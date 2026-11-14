// Offline test fixture bridge: execute the real Python parser, never traceroute.
const { execFileSync } = require('node:child_process')
const { resolve } = require('node:path')

const ROOT = resolve(__dirname, '../..')
function fixtureV2(at) {
  const code = String.raw`
import importlib.util,json,sys
from pathlib import Path
from unittest.mock import patch
patch('subprocess.Popen',side_effect=AssertionError('fixture network process forbidden')).start()
patch('socket.create_connection',side_effect=AssertionError('fixture network forbidden')).start()
root=Path(sys.argv[1])
def load(name):
 spec=importlib.util.spec_from_file_location(name,root/('companion/helper/'+name+'.py'))
 module=importlib.util.module_from_spec(spec)
 spec.loader.exec_module(module)
 return module
helper=load('enhanced_route_helper')
v2=load('enhanced_probe_v2')
result=v2.collect('00000000-0000-4000-8000-000000000001','beijing',['udp','tcp'],helper.TARGETS,None,root/'tests/companion/fixtures/v2',prefix_hints=True)
print(json.dumps(result))
`
  const value = JSON.parse(execFileSync('python3', ['-c', code, ROOT], { encoding: 'utf8', timeout: 10000, maxBuffer: 32768 }))
  if (at) {
    value.collectedAt = at
    for (const rows of Object.values(value.carriers)) {
      for (const row of Object.values(rows))
        row.collectedAt = at
    }
  }
  return value
}
const invalidV2 = [
  ['remote command', r => r.command = 'never-execute'],
  ['wrong UUID', r => r.uuid = '00000000-0000-4000-8000-000000000002'],
  ['wrong schema', r => r.schema = 9],
  ['invalid city', r => r.city = '127.0.0.1;id'],
  ['duplicate protocol', r => r.protocols = ['udp', 'udp']],
  ['empty protocol', r => r.protocols = []],
  ['ICMP protocol', r => r.protocols = ['icmp']],
  ['omitted protocol result', r => delete r.carriers.telecom.tcp],
  ['unknown carrier', r => r.carriers.evil = r.carriers.telecom],
  ['IPv6 family', r => r.carriers.telecom.tcp.family = 6],
  ['protocol mismatch', r => r.carriers.telecom.tcp.protocol = 'udp'],
  ['target URL', r => r.carriers.telecom.tcp.target = 'https://example.invalid'],
  ['target city mismatch', r => r.carriers.telecom.tcp.target = 'shanghai-telecom'],
  ['reverse direction', r => r.carriers.telecom.tcp.direction = 'cn-to-node'],
  ['remote port', r => r.carriers.telecom.tcp.port = 22],
  ['invalid status', r => r.carriers.telecom.tcp.status = 'certified'],
  ['IPv6 hop', r => r.carriers.telecom.tcp.hops[0].ips = ['::1']],
  ['noncanonical IPv4', r => r.carriers.telecom.tcp.hops[0].ips = ['059.43.1.1']],
  ['malformed IP', r => r.carriers.telecom.tcp.hops[0].ips = ['59.43.1.1;id']],
  ['ASN source invented', r => r.carriers.telecom.tcp.hops[0].asnSource = 'commercial-proof'],
  ['ASN without response', r => r.carriers.telecom.tcp.hops[0].ips = []],
  ['ASN source none', r => r.carriers.telecom.tcp.hops[0].asnSource = 'none'],
  ['Cymru source without consent', r => r.carriers.telecom.tcp.hops[0].asnSource = 'team-cymru'],
  ['actual ASN replaced by hint', r => r.carriers.telecom.tcp.hops[0].prefixHints = ['CN2']],
  ['unsupported prefix hint', r => r.carriers.mobile.tcp.hops[0].prefixHints = ['GIA certified']],
  ['prefix hint subject mismatch', r => r.carriers.mobile.tcp.hops[0].prefixHints = ['CN2']],
  ['duplicate ASN', r => r.carriers.telecom.tcp.hops[0].asns = [4809, 4809]],
  ['invalid ASN', r => r.carriers.telecom.tcp.hops[0].asns = [4294967296]],
  ['duplicate response IP', r => r.carriers.telecom.tcp.hops[0].ips.push(r.carriers.telecom.tcp.hops[0].ips[0])],
  ['duplicate TTL', r => r.carriers.telecom.tcp.hops.push(r.carriers.telecom.tcp.hops[0])],
  ['TTL beyond actual max', r => r.carriers.telecom.tcp.hops[0].ttl = 21],
  ['unproven target reached', r => r.carriers.telecom.tcp.hops.pop()],
  ['false ok', r => r.carriers.mobile.tcp.status = 'ok'],
  ['query activity while disabled', r => r.carriers.telecom.tcp.asnLookup.queries = 1],
  ['query budget exceeded', r => Object.values(r.carriers).forEach(c => Object.values(c).forEach((p) => {
    p.asnLookup.enabled = true
    p.asnLookup.queries = 2
  }))],
  ['negative query count', r => r.carriers.telecom.tcp.asnLookup.failures = -1],
  ['batch time after validity window', r => r.collectedAt = '2099-01-01T00:00:00.000Z'],
  ['row time after batch', r => r.carriers.telecom.tcp.collectedAt = new Date(Date.parse(r.collectedAt) + 1).toISOString()],
  ['row time too old', r => r.carriers.telecom.tcp.collectedAt = new Date(Date.parse(r.collectedAt) - 300001).toISOString()],
  ['invalid calendar', r => r.carriers.telecom.tcp.collectedAt = '2026-02-30T00:00:00.000Z'],
]
module.exports = { fixtureV2, invalidV2 }
