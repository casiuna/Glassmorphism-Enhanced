#!/usr/bin/env python3
"""Fixed-purpose outbound return-route helper. Python 3.10+, no third-party deps.

Architecture/target vocabulary references Transit (MIT), copyright (c) 2026
 yyy622hhh and (c) 2025 Tony Liu. See ../enhanced-route-probe/LICENSE.
No tags writeback, remote exec, ICMP privilege escalation or arbitrary target CLI.
"""
import datetime
import ipaddress
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
        url = urllib.parse.urlsplit(value)
        if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
            raise ValueError()
        if url.scheme == 'https' and url.hostname:
            return value.rstrip('/')
        if allow_loopback and url.scheme == 'http' and ipaddress.ip_address(url.hostname).is_loopback:
            return value.rstrip('/')
    except (ValueError, TypeError):
        pass
    raise HelperError('https-required; local-fixtures-allow-only-literal-loopback')

def read_config(path, fixture_dir):
    config = json.loads(private_text(path, 16384))
    if set(config) - {'panel', 'uuid', 'tokenFile', 'enabled', 'allowLoopback'}:
        raise HelperError('unknown-config-fields')
    if not isinstance(config.get('uuid'), str) or not UUID.fullmatch(config['uuid']):
        raise HelperError('invalid-uuid')
    config['panel'] = panel_url(config.get('panel'), config.get('allowLoopback') is True)
    if fixture_dir and not ipaddress.ip_address(urllib.parse.urlsplit(config['panel']).hostname).is_loopback:
        raise HelperError('fixtures-are-loopback-only')
    if not isinstance(config.get('tokenFile'), str) or not Path(config['tokenFile']).is_absolute():
        raise HelperError('absolute-private-token-file-required')
    if config.get('enabled') is not True:
        raise HelperError('helper-disabled')
    return config

def post(config, endpoint, data):
    token = private_text(config['tokenFile'], 4096)
    if not token or any(char.isspace() for char in token):
        raise HelperError('invalid-private-token')
    payload = json.dumps({**data, 'token': token}).encode()
    if len(payload) > 16384:
        raise HelperError('request-output-limit')
    req = urllib.request.Request(config['panel'] + ROOT + endpoint, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=15) as response:
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
        # AS evidence comes from traceroute -A, never from guessed IP prefixes.
        hops.append({'ttl': ttl, 'asns': asns})
        reached = reached or target in IPV4.findall(match[2])
    return sorted(hops, key=lambda hop: hop['ttl']), reached

def execute_trace(target):
    executable = next((str(p) for p in [Path('/usr/bin/traceroute'), Path('/bin/traceroute')] if p.is_file()), None)
    if executable is None:
        return '', 'no-traceroute'
    # Linux traceroute's UDP default requires no root/CAP_NET_RAW. -A asks for
    # actual AS-path lookup evidence; BusyBox variants lacking it fail explicitly.
    argv = [executable, '-n', '-A', '-q', '1', '-w', '1', '-m', '20', target]
    try:
        process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, shell=False, start_new_session=True, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
    except OSError as error:
        return '', 'permission-denied' if isinstance(error, PermissionError) else 'probe-failed'
    output = bytearray()
    assert process.stdout is not None
    outcome = 'ok'
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + TRACE_TIMEOUT
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
    return text, outcome

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
    response = post(config, '/poll', {})
    if response.get('schema') != 1 or response.get('uuid') != config['uuid']:
        raise HelperError('authenticated-uuid-mismatch')
    job = response.get('job')
    if job is None:
        return response.get('state', 'idle')
    if set(job) != {'id', 'city', 'lease', 'leaseUntil'} or not JOB_ID.fullmatch(str(job['id'])) or not JOB_ID.fullmatch(str(job['lease'])) or job['city'] not in TARGETS:
        raise HelperError('invalid-fixed-job')
    if not isinstance(job['leaseUntil'], (int, float)) or not time.time() * 1000 < job['leaseUntil'] <= time.time() * 1000 + 240000:
        raise HelperError('invalid-lease-time')
    result = collect(config['uuid'], job['city'], fixture_dir)
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
        elif flag in ('--config', '--fixture-dir') and args:
            options[flag] = args.pop(0)
        else:
            raise HelperError('unsupported-option; allowed: --config PATH [--once] [--fixture-dir LOCAL_PATH]')
    if '--config' not in options:
        raise HelperError('private-config-required')
    fixture = options.get('--fixture-dir')
    while True:
        config = read_config(options['--config'], fixture)
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
