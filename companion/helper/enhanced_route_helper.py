#!/usr/bin/env python3
"""Fixed-purpose outbound return-route helper. Python 3.10+, no third-party deps.

Architecture/target vocabulary references Transit (MIT), copyright (c) 2026
 yyy622hhh and (c) 2025 Tony Liu. See ../enhanced-route-probe/LICENSE.
No tags writeback, remote exec, ICMP privilege escalation or arbitrary target CLI.
"""
import datetime
import ipaddress
import importlib.util
import json
import os
import re
import selectors
import signal
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = '/api/enhanced-route-probe/v1'
TARGETS = {
    'beijing': ['219.141.140.10', '202.106.195.68', '221.179.155.161'],
    'shanghai': ['202.96.209.133', '210.22.97.1', '211.136.112.200'],
    'guangzhou': ['58.60.188.222', '210.21.196.6', '120.196.165.24'],
    'hubei': ['202.103.24.68', '218.104.111.122', '211.137.58.20'],
}
CARRIERS = ['telecom', 'unicom', 'mobile']
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
JOB_ID = re.compile(r'^[0-9a-f]{48}$')
TRACE_TIMEOUT = 25
HOP = re.compile(r'^\s*(\d{1,2})\s+(.+)$')
ASN = re.compile(r'\[AS(\d{1,10})\]')
IPV4 = re.compile(r'(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])')

class HelperError(Exception):
    pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HelperError('redirect-rejected')

def private_text(path, limit):
    """Do not follow a token/config symlink or read group/world-readable secrets."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > limit:
            raise HelperError('private-file-permissions')
        return os.read(fd, limit + 1).decode().strip()
    finally:
        os.close(fd)

def panel_url(value, allow_loopback=False):
    try:
        if not isinstance(value, str) or any(char.isspace() or ord(char) < 32 for char in value) or any(char in value for char in ('?', '#', '\\')):
            raise ValueError()
        url = urllib.parse.urlsplit(value)
        if url.username is not None or url.password is not None or url.query or url.fragment or url.path not in ('', '/') or '%' in url.netloc or url.port == 0:
            raise ValueError()
        if url.scheme == 'https' and url.hostname:
            return value.rstrip('/')
        if allow_loopback and url.scheme == 'http' and ipaddress.ip_address(url.hostname or '').is_loopback:
            return value.rstrip('/')
    except (ValueError, TypeError):
        pass
    raise HelperError('https-required; local-fixtures-allow-only-literal-loopback')

def read_config(path, fixture_dir, *, replay=False):
    config = json.loads(private_text(path, 16384))
    if not isinstance(config, dict) or set(config) - {'panel', 'uuid', 'tokenFile', 'enabled', 'allowLoopback', 'probeProtocols', 'addressFamily', 'cymruEnabled', 'cymruConsent', 'prefixHints', 'cdnTargets'}:
        raise HelperError('unknown-config-fields')
    if not isinstance(config.get('uuid'), str) or not UUID.fullmatch(config['uuid']):
        raise HelperError('invalid-uuid')
    config['panel'] = panel_url(config.get('panel'), config.get('allowLoopback') is True)
    if fixture_dir and not ipaddress.ip_address(urllib.parse.urlsplit(config['panel']).hostname).is_loopback:
        raise HelperError('fixtures-are-loopback-only')
    if not isinstance(config.get('tokenFile'), str) or not Path(config['tokenFile']).is_absolute():
        raise HelperError('absolute-private-token-file-required')
    if config.get('enabled') is not True and not replay:
        raise HelperError('helper-disabled')
    if config.get('addressFamily', 4) != 4 or type(config.get('addressFamily', 4)) is not int:
        raise HelperError('ipv6-not-validated-disabled')
    if 'probeProtocols' in config and (not isinstance(config['probeProtocols'], list) or not 1 <= len(config['probeProtocols']) <= 2 or any(p not in ('tcp', 'udp') for p in config['probeProtocols']) or len(set(config['probeProtocols'])) != len(config['probeProtocols'])):
        raise HelperError('invalid-local-protocol-selection')
    for flag in ('cymruEnabled', 'cymruConsent', 'prefixHints'):
        if flag in config and type(config[flag]) is not bool:
            raise HelperError('invalid-local-probe-option')
    if config.get('cymruEnabled') and (not config.get('cymruConsent') or 'probeProtocols' not in config):
        raise HelperError('external-asn-consent-required')
    if 'cdnTargets' in config:
        module = probe_module()
        module.cdn_profiles(config['cdnTargets'])
        if config.get('probeProtocols') != ['udp', 'tcp']:
            raise HelperError('cdn-requires-explicit-dual-protocols')
    return config

def probe_module():
    spec = importlib.util.spec_from_file_location('enhanced_probe_v2', Path(__file__).with_name('enhanced_probe_v2.py'))
    if spec is None or spec.loader is None:
        raise HelperError('missing-probe-module')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def post(config, endpoint, data):
    token = private_text(config['tokenFile'], 4096)
    if not token or any(char.isspace() for char in token):
        raise HelperError('invalid-private-token')
    payload = json.dumps({**data, 'token': token}).encode()
    if len(payload) > 16384:
        raise HelperError('request-output-limit')
    req = urllib.request.Request(config['panel'] + ROOT + endpoint, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(req, timeout=15) as response:
            source = response.read(16385)
            if len(source) > 16384:
                raise HelperError('response-output-limit')
            return json.loads(source)
    except urllib.error.HTTPError as error:
        # Do not log URLs, payloads, headers or remote exception messages.
        raise HelperError('panel-http-' + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise HelperError('panel-transport-failed') from None

def parse_trace(text, target):
    hops = []
    reached = False
    seen = set()
    for line in text.splitlines():
        match = HOP.match(line)
        if not match:
            continue
        ttl = int(match[1])
        if not 1 <= ttl <= 20 or ttl in seen:
            continue
        seen.add(ttl)
        asns = list(dict.fromkeys(int(value) for value in ASN.findall(match[2]) if 0 < int(value) <= 4294967295))[:4]
        # Read old annotated output/fixtures without turning prefixes into ASN.
        hops.append({'ttl': ttl, 'asns': asns})
        reached = reached or (target in IPV4.findall(match[2]) and not re.search(r'!(?:[A-Za-z]|\d)', match[2]))
    return sorted(hops, key=lambda hop: hop['ttl']), reached

def execute_trace(target, protocol='udp', timeout=None, *, cdn_pins=None, port=None):
    cdn = cdn_pins is not None
    if cdn and (type(cdn_pins) is not frozenset or target not in cdn_pins or probe_module().public_cdn_ip(target) != target or type(port) is not int or port not in (80, 443)):
        raise HelperError('locally-pinned-public-CDN-target-required')
    if (not cdn and target not in {ip for ips in TARGETS.values() for ip in ips}) or protocol not in ('tcp', 'udp') or (not cdn and port is not None):
        raise HelperError('fixed-ipv4-target-and-protocol-required')
    if timeout is not None and timeout <= 0:
        return ('', 'timeout', None) if cdn else ('', 'timeout')
    executable = next((str(p) for p in [Path('/usr/bin/traceroute'), Path('/bin/traceroute')] if p.is_file()), None)
    if executable is None:
        return ('', 'no-traceroute', None) if cdn else ('', 'no-traceroute')
    # No -A: native traceroute ASN lookup can contact external registries even
    # when Cymru is disabled, outside our consent, budget and per-query timeout.
    # Actual ASN enrichment is exclusively the explicit, bounded local opt-in.
    argv = [executable, '-4', '-n', '-q', '1', '-w', '1', '-m', '20', target]
    if cdn:
        argv[1:1] = ['-T' if protocol == 'tcp' else '-U', '-p', str(port), '-N', '1', '-z', '0.05']
    elif protocol == 'tcp':
        argv[1:1] = ['-T', '-p', '443']
    try:
        process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, shell=False, start_new_session=True, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
    except OSError as error:
        outcome = 'permission-denied' if isinstance(error, PermissionError) else 'probe-failed'
        return ('', outcome, None) if cdn else ('', outcome)
    output = bytearray()
    assert process.stdout is not None
    outcome = 'ok'
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + min(TRACE_TIMEOUT, max(0, timeout)) if timeout is not None else time.monotonic() + TRACE_TIMEOUT
    try:
        while selector.get_map():
            if time.monotonic() >= deadline:
                outcome = 'timeout'
                break
            for key, _ in selector.select(0.25):
                chunk = os.read(key.fd, 8192)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                output.extend(chunk)
                if len(output) > 65536:
                    outcome = 'output-limit'
                    break
            if outcome != 'ok':
                break
    finally:
        selector.close()
        if outcome == 'ok':
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                outcome = 'timeout'
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()
        process.stdout.close()
    text = bytes(output[:65536]).decode('utf-8', errors='replace')
    if outcome == 'ok' and process.returncode:
        outcome = 'permission-denied' if re.search(r'permission|not permitted', text, re.I) else 'probe-failed'
    return (text, outcome, process.returncode) if cdn else (text, outcome)

def collect(uuid, city, fixture_dir=None, runner=execute_trace):
    if city not in TARGETS:
        raise HelperError('unsupported-city')
    carriers = {}
    for carrier, target in zip(CARRIERS, TARGETS[city]):
        if fixture_dir:
            source = Path(fixture_dir, city + '-' + carrier + '.txt')
            if not source.is_file() or source.stat().st_size > 65536:
                raise HelperError('invalid-local-fixture')
            text = source.read_text()
            status = 'ok'
        else:
            text, status = runner(target)
        hops, reached = parse_trace(text, target)
        if status == 'ok' and (not reached or not any(hop['asns'] for hop in hops)):
            status = 'unknown'
        carriers[carrier] = {'direction': 'node-to-cn', 'target': city + '-' + carrier, 'status': status, 'reachedTarget': reached, 'hops': hops}
    return {'schema': 1, 'uuid': uuid, 'city': city, 'collectedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'), 'source': 'fixture' if fixture_dir else 'helper', 'carriers': carriers}

def cycle(config, fixture_dir=None):
    version = json.loads(Path(__file__).with_name('helper-version.json').read_text())['version']
    response = post(config, '/poll', {'helper_version': version})
    if type(response.get('schema')) is not int or response.get('schema') != 1 or response.get('uuid') != config['uuid']:
        raise HelperError('authenticated-uuid-mismatch')
    job = response.get('job')
    if job is None:
        return response.get('state', 'idle')
    if not isinstance(job, dict) or set(job) not in ({'id', 'city', 'lease', 'leaseUntil'}, {'id', 'city', 'lease', 'leaseUntil', 'targetBinding'}) or not JOB_ID.fullmatch(str(job.get('id'))) or not JOB_ID.fullmatch(str(job.get('lease'))) or not isinstance(job.get('city'), str) or (job['city'] not in TARGETS and job['city'] not in config.get('cdnTargets', {})):
        raise HelperError('invalid-fixed-job')
    if not isinstance(job['leaseUntil'], (int, float)) or not time.time() * 1000 < job['leaseUntil'] <= time.time() * 1000 + 240000:
        raise HelperError('invalid-lease-time')
    module = probe_module()
    try:
        if job['city'] == module.CDN_ID:
            if fixture_dir:
                raise HelperError('CDN-fixtures-not-live-evidence')
            result = module.run_cdn_job(config, job, execute_trace, private_text)
        elif 'targetBinding' in job:
            raise HelperError('unexpected-fixed-job-binding')
        elif 'probeProtocols' in config:
            result = module.run_job(config, job, TARGETS, execute_trace, private_text, fixture_dir)
        elif fixture_dir:
            result = collect(config['uuid'], job['city'], fixture_dir)
        else:
            with module.runtime(config['tokenFile'], private_text, os.environ.get('STATE_DIRECTORY')):
                result = collect(config['uuid'], job['city'])
    except ValueError:
        raise HelperError('local-probe-safety-check-failed') from None
    accepted = post(config, '/result', {'uuid': config['uuid'], 'job_id': job['id'], 'lease': job['lease'], 'result': result})
    if accepted.get('accepted') is not True:
        raise HelperError('result-not-accepted')
    return 'fixture-accepted' if fixture_dir else 'result-accepted'

def main():
    options = {}
    args = sys.argv[1:]
    while args:
        flag = args.pop(0)
        if flag == '--once':
            options[flag] = True
        elif flag in ('--config', '--fixture-dir', '--replay-dir') and args:
            options[flag] = args.pop(0)
        else:
            raise HelperError('unsupported-option; allowed: --config PATH [--once] [--fixture-dir LOCAL_PATH]')
    if '--config' not in options:
        raise HelperError('private-config-required')
    fixture = options.get('--fixture-dir')
    announced = False
    while True:
        config = read_config(options['--config'], fixture, replay='--replay-dir' in options)
        if '--replay-dir' in options:
            if fixture or not options.get('--once') or not config.get('allowLoopback') or not ipaddress.ip_address(urllib.parse.urlsplit(config['panel']).hostname).is_loopback:
                raise HelperError('replay-once-literal-loopback-only')
            print(json.dumps(probe_module().replay_cdn(config, options['--replay-dir']), separators=(',', ':')))
            return
        if config.get('cymruEnabled') and not announced:
            print('Team Cymru ASN enrichment enabled with local consent: public hop IPs may be sent to whois.cymru.com:43; no Agent credential is sent. Fixtures never query external services.', file=sys.stderr, flush=True)
            announced = True
        try:
            print(cycle(config, fixture), flush=True)
        except HelperError as error:
            if options.get('--once'):
                raise
            print(str(error), file=sys.stderr, flush=True)
        if options.get('--once'):
            return
        time.sleep(30)

if __name__ == '__main__':
    try:
        main()
    except (HelperError, ValueError, OSError):
        # Fixed redacted category only; never echo arbitrary CLI values or secrets.
        print('helper-failed: check private config, permissions, authentication and fixed-probe requirements', file=sys.stderr)
        sys.exit(1)
