# SPDX-License-Identifier: MIT
"""Independent fixed-purpose protocol evidence collector; no TcpQuality code.

The caller supplies the existing fixed-target, bounded traceroute executor.
No shell, dependency installer, speed test, upload service, or IPv6 support.
"""
import contextlib
import datetime
import fcntl
import hashlib
import ipaddress
import json
import math
import os
import re
import stat
import subprocess
import sys
import time
from pathlib import Path

CARRIERS = ('telecom', 'unicom', 'mobile')
PROTOCOLS = ('udp', 'tcp')
HOP = re.compile(r'^\s*(\d{1,2})\s+(.+)$')
IP = re.compile(r'(?<![\da-fA-F:.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.:])')
ASN = re.compile(r'\[AS(\d{1,10})\]')
UNREACHABLE = re.compile(r'!(?:[A-Za-z]|\d)')
# Descriptive address hints only: these are NEVER inserted into actual ASNs.
HINTS = (('59.43.', 'CN2'), ('202.97.', '163'), ('223.120.', 'CMI'))
MAX_RESULT = 11000  # leaves room for the native credential and lease in 16 KiB
# Fixed WHOIS client, executed in a killable child so even DNS is time-bounded.
CYMRU_CLIENT = """import socket,sys
ip=sys.argv[1]
with socket.create_connection(('whois.cymru.com',43),timeout=1) as s:
 s.sendall(('begin\\nverbose\\n'+ip+'\\nend\\n').encode('ascii'))
 data=bytearray()
 while len(data)<=4096:
  chunk=s.recv(min(1024,4097-len(data)))
  if not chunk:break
  data.extend(chunk)
 if len(data)>4096:raise SystemExit(2)
 sys.stdout.write(data.decode('ascii'))
"""


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def public_ip(value):
    try:
        ip = ipaddress.IPv4Address(value)
        return str(ip) if ip.is_global and not ip.is_multicast and not ip.is_reserved else None
    except (ValueError, TypeError):
        return None


def query_cymru(ip, timeout):
    if not public_ip(ip) or not 0 < timeout <= 2:
        raise ValueError('public IPv4 / bounded query required')
    result = subprocess.run([sys.executable, '-c', CYMRU_CLIENT, ip], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, shell=False, timeout=timeout, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
    if result.returncode or len(result.stdout) > 4096:
        raise ValueError('ASN query failed')
    return result.stdout.decode('ascii')


class AsnEnricher:
    def __init__(self, enabled=False, cache=None, query=query_cymru, clock=time.time):
        self.enabled = enabled
        self.cache = cache if cache is not None else {}
        self.query = query
        self.clock = clock
        self.queries = self.cache_hits = self.failures = 0

    def lookup(self, ip, deadline):
        if not self.enabled or not public_ip(ip):
            return []
        now = self.clock()
        saved = self.cache.get(ip)
        if saved and saved['expires'] > now:
            self.cache_hits += 1
            return list(saved['asns'])
        remaining = deadline - time.monotonic()
        if self.queries >= 8 or remaining <= 0:
            self.failures += 1
            return []
        self.queries += 1
        values = []
        try:
            text = self.query(ip, min(2, remaining))
            if not isinstance(text, str) or len(text.encode()) > 4096:
                raise ValueError('ASN response limit')
            matched = False
            for line in text.splitlines():
                fields = [v.strip() for v in line.split('|')]
                if len(fields) < 2 or not fields[0] or not all(v.isdecimal() for v in fields[0].split()):
                    continue
                if fields[1] != ip:
                    raise ValueError('ASN response subject mismatch')
                found = [int(v) for v in fields[0].split()]
                if not found or any(not 0 < n <= 4294967295 for n in found):
                    raise ValueError('invalid ASN')
                values.extend(found)
                matched = True
            values = list(dict.fromkeys(values))
            if not matched or len(values) > 4:
                raise ValueError('missing/ambiguous ASN response')
        except (OSError, ValueError, subprocess.SubprocessError, UnicodeError):
            self.failures += 1
            values = []
        self.cache[ip] = {'asns': values, 'expires': now + (3600 if values else 300)}
        if len(self.cache) > 512:
            del self.cache[min(self.cache, key=lambda key: self.cache[key]['expires'])]
        return values


def parse_trace(text, target, enricher, deadline, prefix_hints=False):
    rows = {}
    reached = False
    overflow = False
    for line in text.splitlines():
        match = HOP.match(line)
        if not match or not 1 <= int(match[1]) <= 20:
            continue
        ttl = int(match[1])
        ips = []
        for value in IP.findall(match[2]):
            try:
                ips.append(str(ipaddress.IPv4Address(value)))
            except ValueError:
                pass
        asns = list(dict.fromkeys(int(n) for n in ASN.findall(match[2]) if 0 < int(n) <= 4294967295)) if ips else []
        row = rows.setdefault(ttl, {'ttl': ttl, 'ips': [], 'asns': [], 'asnSource': 'none'})
        row['ips'] = list(dict.fromkeys(row['ips'] + ips))
        row['asns'] = list(dict.fromkeys(row['asns'] + asns))
        overflow |= len(row['ips']) > 4 or len(row['asns']) > 4
        reached |= target in ips and not UNREACHABLE.search(match[2])
    if overflow:
        return [], False, True
    for row in rows.values():
        if row['asns']:
            row['asnSource'] = 'traceroute'
        else:
            found = []
            for ip in row['ips']:
                found.extend(enricher.lookup(ip, deadline))
            row['asns'] = list(dict.fromkeys(found))
            if len(row['asns']) > 4:
                return [], False, True
            row['asnSource'] = 'team-cymru' if row['asns'] else 'none'
        if prefix_hints and not row['asns']:
            hints = sorted({hint for ip in row['ips'] for prefix, hint in HINTS if ip.startswith(prefix)})
            if hints:
                row['prefixHints'] = hints
    return sorted(rows.values(), key=lambda r: r['ttl']), bool(reached), False


def collect(uuid, city, protocols, targets, runner, fixture_dir=None, enricher=None, prefix_hints=False, deadline=None):
    if city not in targets or not isinstance(protocols, list) or not 1 <= len(protocols) <= 2 or any(p not in PROTOCOLS for p in protocols) or len(set(protocols)) != len(protocols):
        raise ValueError('fixed city/protocol selection required')
    deadline = deadline if deadline is not None else time.monotonic() + 164
    enricher = enricher or AsnEnricher()
    if fixture_dir and enricher.enabled:
        raise ValueError('external queries forbidden for fixture collection')
    carriers = {}
    for carrier, target in zip(CARRIERS, targets[city]):
        carriers[carrier] = {}
        for protocol in protocols:
            counts = (enricher.queries, enricher.cache_hits, enricher.failures)
            if fixture_dir:
                path = Path(fixture_dir, f'{city}-{carrier}-{protocol}.txt')
                if protocol == 'udp' and not path.exists():
                    path = Path(fixture_dir, f'{city}-{carrier}.txt')
                if path.is_symlink() or not path.is_file() or path.stat().st_size > 65536:
                    raise ValueError('bounded local fixture required')
                text, status = path.read_text(), 'ok'
            else:
                remaining = deadline - time.monotonic()
                text, status = runner(target, protocol=protocol, timeout=min(25, max(0, remaining))) if remaining > 0 else ('', 'timeout')
            if len(text.encode()) > 65536:
                text, status = '', 'output-limit'
            hops, reached, overflow = parse_trace(text, target, enricher, deadline, prefix_hints)
            if overflow:
                status = 'output-limit'
            if status == 'ok' and (not reached or not any(h['asns'] for h in hops)):
                status = 'unknown'
            carriers[carrier][protocol] = {'protocol': protocol, 'family': 4, 'direction': 'node-to-cn', 'target': f'{city}-{carrier}', 'collectedAt': stamp(), 'status': status, 'reachedTarget': reached, 'hops': hops, 'asnLookup': {'enabled': enricher.enabled, 'queries': enricher.queries-counts[0], 'cacheHits': enricher.cache_hits-counts[1], 'failures': enricher.failures-counts[2]}}
    result = {'schema': 2, 'uuid': uuid, 'city': city, 'protocols': list(protocols), 'source': 'fixture' if fixture_dir else 'helper', 'collectedAt': stamp(), 'carriers': carriers}
    # Preserve the 16 KiB native plugin permission. Oversize evidence is a
    # visible per-protocol failure, never silently truncated into a valid path.
    rows = [row for values in carriers.values() for row in values.values()]
    while len(json.dumps(result).encode()) > MAX_RESULT:
        row = max(rows, key=lambda r: len(json.dumps(r['hops'])))
        if not row['hops']:
            raise ValueError('fixed result envelope exceeds budget')
        row.update(hops=[], reachedTarget=False, status='output-limit')
    return result


def save_runtime(path, state):
    temporary = path.with_name('.route-runtime.pending')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'w') as output:
            json.dump(state, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


@contextlib.contextmanager
def runtime(token_file, private_reader, state_dir=None):
    directory = Path(state_dir) if state_dir else Path(token_file).parent
    path = directory / 'route-runtime.json'
    if any(p.is_symlink() for p in [path, path.parent, *path.parents]):
        raise ValueError('private runtime path required')
    info = directory.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('owner-only runtime directory required')
    lock = path.with_name('route-runtime.lock')
    fd = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError('private runtime lock required')
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = json.loads(private_reader(path, 131072)) if path.exists() else {'version': 1, 'lastProbe': 0, 'cache': {}}
        if not isinstance(state, dict) or set(state) != {'version', 'lastProbe', 'cache'} or type(state['version']) is not int or state['version'] != 1 or type(state['lastProbe']) not in (int, float) or not math.isfinite(state['lastProbe']) or state['lastProbe'] < 0 or not isinstance(state['cache'], dict) or len(state['cache']) > 512:
            raise ValueError('invalid private runtime')
        for ip, row in state['cache'].items():
            if not public_ip(ip) or not isinstance(row, dict) or set(row) != {'asns', 'expires'} or not isinstance(row['asns'], list) or len(row['asns']) > 4 or any(type(n) is not int or not 0 < n <= 4294967295 for n in row['asns']) or type(row['expires']) not in (int, float) or not math.isfinite(row['expires']):
                raise ValueError('invalid private ASN cache')
        if time.time() - state['lastProbe'] < 60:
            raise ValueError('local probe cooldown')
        state['lastProbe'] = time.time()
        save_runtime(path, state)  # reserve durably BEFORE executing a probe
        try:
            yield state
        finally:
            save_runtime(path, state)
    finally:
        os.close(fd)


def run_job(config, job, targets, runner, private_reader, fixture_dir=None):
    if config.get('cymruEnabled') and config.get('cymruConsent') is not True:
        raise ValueError('explicit local Cymru consent required')
    def execute(cache):
        enrich = AsnEnricher(enabled=config.get('cymruEnabled') is True and not fixture_dir, cache=cache)
        deadline = time.monotonic() + max(0, min(164, (job['leaseUntil'] - time.time()*1000)/1000 - 16))
        return collect(config['uuid'], job['city'], config['probeProtocols'], targets, runner, fixture_dir, enrich, config.get('prefixHints') is True, deadline)
    if fixture_dir:
        return execute({})  # no external query / local shell, no fixture throttle
    with runtime(config['tokenFile'], private_reader, os.environ.get('STATE_DIRECTORY')) as state:
        return execute(state['cache'])


# Reviewed catalog, NOT a remotely supplied hostname/IP/command. Both the
# private local configuration and administrator plugin policy must authorize
# the exact catalog and ports. Additional domains require a source review.
CDN_HOSTS = {'telecom': 'hb-ct-v4.ip.zstaticcdn.com', 'unicom': 'hb-cu-v4.ip.zstaticcdn.com', 'mobile': 'hb-cm-v4.ip.zstaticcdn.com'}
CDN_ID = 'hubei-cdn'


def cdn_profiles(value):
    if not isinstance(value, dict) or set(value) - {CDN_ID}:
        raise ValueError('reviewed CDN catalog required')
    for profile in value.values():
        if not isinstance(profile, dict) or set(profile) != set(CARRIERS):
            raise ValueError('three approved carriers required')
        for carrier, row in profile.items():
            if not isinstance(row, dict) or set(row) != {'hostname', 'udpPort', 'tcpPort'} or row['hostname'] != CDN_HOSTS[carrier]:
                raise ValueError('unapproved CDN hostname')
            if any(type(row[k]) is not int or row[k] not in (80, 443) for k in ('udpPort', 'tcpPort')):
                raise ValueError('unapproved CDN port')
    return value


def cdn_binding(profile):
    return json.dumps([[c, profile[c]['hostname'], profile[c]['udpPort'], profile[c]['tcpPort']] for c in CARRIERS], separators=(',', ':'))


def public_cdn_ip(value):
    ip = public_ip(value)
    if ip is None:
        return None
    a, b, c, _ = map(int, ip.split('.'))
    # Same conservative catalog DNS boundary as Plugin and Theme, including
    # special-purpose anycast/protocol networks Python versions may call global.
    if a == 192 and (b == 0 or (b == 88 and c == 99)):
        return None
    return ip


def cdn_dns(rows, profile):
    if not isinstance(rows, list) or len(rows) != 3 or {r.get('carrier') for r in rows} != set(CARRIERS):
        raise ValueError('three unique DNS snapshots required')
    result = {}
    for row in rows:
        carrier = row['carrier']
        addresses = row['allResolvedIPv4']
        if row['hostname'] != profile[carrier]['hostname'] or not isinstance(addresses, list) or not 1 <= len(addresses) <= 16 or len(set(addresses)) != len(addresses) or any(public_cdn_ip(ip) != ip for ip in addresses) or row['selectedIPv4'] not in addresses:
            raise ValueError('unsafe DNS answers; no private/mixed/rebinding fallback')
        result[carrier] = {'hostname': row['hostname'], 'addresses': addresses, 'selectedIPv4': row['selectedIPv4'], 'resolvedAt': row['finishedAt']}
    return result


def resolve_cdn(profile, resolver=None):
    # Child timeout includes OS DNS. No custom DNS server, URL, redirects or
    # CNAME command is accepted. Resolve ONCE before either protocol executes.
    code = 'import socket,sys,json;print(json.dumps(list(dict.fromkeys(r[4][0] for r in socket.getaddrinfo(sys.argv[1],None,socket.AF_INET,socket.SOCK_STREAM)))))'
    rows = []
    for carrier in CARRIERS:
        host = profile[carrier]['hostname']
        if host != CDN_HOSTS[carrier]:
            raise ValueError('unapproved resolver name')
        if resolver is None:
            r = subprocess.run([sys.executable, '-c', code, host], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, shell=False, timeout=8, env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1'})
            if r.returncode or len(r.stdout) > 4096:
                raise ValueError('bounded DNS failed')
            addresses = json.loads(r.stdout)
        else:
            addresses = resolver(host)
        rows.append({'carrier': carrier, 'hostname': host, 'allResolvedIPv4': addresses, 'selectedIPv4': addresses[0] if addresses else None, 'finishedAt': stamp()})
    return cdn_dns(rows, profile)


def cdn_result(config, dns, records, collected_at, source, origin, row_times=None, enricher=None):
    profile = cdn_profiles(config.get('cdnTargets', {}))[CDN_ID]
    if len(records) != 6 or source not in ('helper', 'replay'):
        raise ValueError('complete recorded batch required')
    enrich = enricher or AsnEnricher(enabled=False)
    carriers, captures = {}, {}
    seen = set()
    for record in records:
        carrier, protocol = record['carrier'], record['protocol']
        if carrier not in CARRIERS or protocol not in PROTOCOLS or (carrier, protocol) in seen:
            raise ValueError('duplicate/unapproved capture')
        seen.add((carrier, protocol))
        text = record['stdoutStderrCombined']
        target = dns[carrier]['selectedIPv4']
        if record['target'] != target or record['hostname'] != profile[carrier]['hostname'] or record['port'] != profile[carrier][protocol + 'Port'] or len(text.encode()) > 65536 or hashlib.sha256(text.encode()).hexdigest() != record['rawSha256']:
            raise ValueError('capture target/port/hash mismatch')
        before = (enrich.queries, enrich.cache_hits, enrich.failures)
        hops, reached, overflow = parse_trace(text, target, enrich, time.monotonic() + 16, False)
        status = 'output-limit' if overflow else record['executionStatus']
        if status == 'ok' and (not reached or not any(h['asns'] for h in hops)):
            status = 'unknown'
        carriers.setdefault(carrier, {})[protocol] = {'protocol': protocol, 'family': 4, 'direction': 'node-to-cn', 'target': f'{CDN_ID}-{carrier}', 'collectedAt': row_times[carrier][protocol] if row_times else record['finishedAt'], 'status': status, 'reachedTarget': reached, 'hops': hops, 'asnLookup': {'enabled': enrich.enabled, 'queries': enrich.queries-before[0], 'cacheHits': enrich.cache_hits-before[1], 'failures': enrich.failures-before[2]}}
        captures.setdefault(carrier, {})[protocol] = {'port': record['port'], 'exitCode': record['exitCode'], 'executionStatus': record['executionStatus'], 'rawSha256': record['rawSha256']}
    value = {'schema': 3, 'uuid': config['uuid'], 'city': CDN_ID, 'source': source, 'protocols': list(PROTOCOLS), 'collectedAt': collected_at, 'targetBinding': cdn_binding(profile), 'dns': dns, 'captures': captures, 'captureOrigin': origin, 'carriers': carriers}
    if len(json.dumps(value).encode()) > 14000:
        raise ValueError('CDN envelope exceeds native bounded transport; evidence not truncated')
    return value


def replay_cdn(config, directory):
    # Explicit private local operation. No resolver, traceroute, WHOIS or panel
    # request; caller imports only through disabled/admin restore-node.
    directory = Path(directory)
    if any(p.is_symlink() for p in [directory, *directory.parents]) or directory.stat().st_mode & 0o077 or directory.stat().st_uid != os.getuid():
        raise ValueError('owner-only capture directory required')
    def read(name):
        path = directory / name
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 131072 or path.stat().st_mode & 0o077 or path.stat().st_uid != os.getuid():
            raise ValueError('unsafe recorded input')
        return json.loads(path.read_text())
    profile = cdn_profiles(config.get('cdnTargets', {}))[CDN_ID]
    original = read('remote-result.json')
    dns = cdn_dns(read('dns-records.json'), profile)
    records = read('trace-records.json')
    times = {c: {p: original['carriers'][c][p]['collectedAt'] for p in PROTOCOLS} for c in CARRIERS}
    value = cdn_result(config, dns, records, original['collectedAt'], 'replay', {'uuid': original['uuid'], 'city': original['city'], 'collectedAt': original['collectedAt']}, times)
    for c in CARRIERS:
        for p in PROTOCOLS:
            a, b = value['carriers'][c][p], original['carriers'][c][p]
            if any(a[k] != b[k] for k in ('hops', 'reachedTarget', 'status', 'collectedAt', 'asnLookup')):
                raise ValueError('recorded parser mismatch')
    return value


def run_cdn_job(config, job, runner, private_reader):
    profile = cdn_profiles(config.get('cdnTargets', {})).get(job['city'])
    if profile is None or job.get('targetBinding') != cdn_binding(profile) or config.get('probeProtocols') != list(PROTOCOLS):
        raise ValueError('remote profile not locally authorized')
    if job['leaseUntil'] <= time.time()*1000 or (config.get('cymruEnabled') and config.get('cymruConsent') is not True):
        raise ValueError('expired lease or missing local ASN consent')
    with runtime(config['tokenFile'], private_reader, os.environ.get('STATE_DIRECTORY')) as state:
        dns = resolve_cdn(profile)
        records = []
        deadline = time.monotonic() + max(0, min(164, (job['leaseUntil'] - time.time()*1000)/1000 - 16))
        pins = frozenset(row['selectedIPv4'] for row in dns.values())
        for carrier in CARRIERS:
            for protocol in PROTOCOLS:
                target, port = dns[carrier]['selectedIPv4'], profile[carrier][protocol + 'Port']
                text, status, code = runner(target, protocol=protocol, timeout=max(0, min(25, deadline-time.monotonic())), cdn_pins=pins, port=port)
                records.append({'carrier': carrier, 'protocol': protocol, 'hostname': profile[carrier]['hostname'], 'target': target, 'port': port, 'stdoutStderrCombined': text, 'rawSha256': hashlib.sha256(text.encode()).hexdigest(), 'executionStatus': status, 'exitCode': code, 'finishedAt': stamp()})
        now = stamp()
        enrich = AsnEnricher(enabled=config.get('cymruEnabled') is True and config.get('cymruConsent') is True, cache=state['cache'])
        return cdn_result(config, dns, records, now, 'helper', {'uuid': config['uuid'], 'city': CDN_ID, 'collectedAt': now}, enricher=enrich)
