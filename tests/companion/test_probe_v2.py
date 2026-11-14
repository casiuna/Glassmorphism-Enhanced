"""Offline/simulated evidence tests. Never sends a real probe or WHOIS query."""
import importlib.util
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/companion/fixtures/v2'
UUID = '00000000-0000-4000-8000-000000000001'


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'companion/helper/{name}.py')
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helper = load('enhanced_route_helper')
v2 = load('enhanced_probe_v2')


class ProbeV2Tests(unittest.TestCase):
    def fixture(self, protocols=None, **options):
        with mock.patch.object(subprocess, 'Popen', side_effect=AssertionError('fixture must never spawn a network process')), mock.patch.object(socket, 'create_connection', side_effect=AssertionError('fixture must never use network')):
            return v2.collect(UUID, 'beijing', protocols or ['udp', 'tcp'], helper.TARGETS, None, FIXTURES, **options)

    def test_protocols_stay_separate_and_every_hop_has_ipv4_asn_provenance(self):
        data = self.fixture(prefix_hints=True)
        self.assertEqual(data['schema'], 2)
        self.assertEqual(data['source'], 'fixture')
        self.assertEqual(data['protocols'], ['udp', 'tcp'])
        self.assertNotEqual(data['carriers']['telecom']['tcp']['hops'], data['carriers']['telecom']['udp']['hops'])
        for carrier in data['carriers'].values():
            for protocol, row in carrier.items():
                self.assertEqual(row['protocol'], protocol)
                self.assertEqual(row['family'], 4)
                self.assertTrue(row['reachedTarget'])
                self.assertFalse(row['asnLookup']['enabled'])
                for hop in row['hops']:
                    self.assertEqual(set(hop) - {'ttl', 'ips', 'asns', 'asnSource', 'prefixHints'}, set())
        self.assertEqual(data['carriers']['mobile']['tcp']['hops'][0]['asns'], [])
        self.assertEqual(data['carriers']['mobile']['tcp']['hops'][0]['prefixHints'], ['CMI'])
        self.assertEqual(data['carriers']['mobile']['tcp']['status'], 'unknown')

    def test_tcp_only_udp_only_and_legacy_udp_fixture_fallback(self):
        for protocol in ('tcp', 'udp'):
            data = self.fixture([protocol])
            self.assertTrue(all(list(row) == [protocol] for row in data['carriers'].values()))
        fallback = v2.collect(UUID, 'beijing', ['udp'], helper.TARGETS, None, ROOT / 'tests/companion/fixtures')
        self.assertEqual(fallback['carriers']['telecom']['udp']['hops'][0]['asns'], [4134])

    def test_invalid_city_protocol_duplicate_and_injection_cannot_reach_executor(self):
        for city, protocols in [('beijing;never', ['tcp']), ('beijing', ['icmp']), ('beijing', ['udp', 'udp']), ('beijing', []), ('beijing', ['tcp;id'])]:
            with self.subTest(city=city, protocols=protocols), self.assertRaises(ValueError):
                v2.collect(UUID, city, protocols, helper.TARGETS, mock.Mock(side_effect=AssertionError('must not execute')))
        for target in ['127.0.0.1', '::1', '219.141.140.10;id', 'https://example.invalid']:
            with self.assertRaises(helper.HelperError):
                helper.execute_trace(target, 'tcp')

    def test_hidden_duplicate_ttl_and_unreachable_target_are_not_false_success(self):
        hops, reached, overflow = v2.parse_trace('1 59.43.1.1 [AS4809]\n1 59.43.1.2 [AS4809]\n2 * * *\n3 219.141.140.10 [AS4134] !H', '219.141.140.10', v2.AsnEnricher(), time.monotonic() + 1)
        self.assertFalse(reached)
        self.assertFalse(overflow)
        self.assertEqual(hops[0]['ips'], ['59.43.1.1', '59.43.1.2'])
        self.assertEqual(hops[1], {'ttl': 2, 'ips': [], 'asns': [], 'asnSource': 'none'})
        rows = v2.parse_trace('1 ::ffff:219.141.140.10 [AS4809]', '219.141.140.10', v2.AsnEnricher(), time.monotonic() + 1)
        self.assertFalse(rows[1])
        self.assertEqual(rows[0][0]['asns'], [])

    def test_prefix_hint_is_not_asn_and_never_overrides_real_asn(self):
        hops, _, _ = v2.parse_trace('1 59.43.1.1\n2 59.43.2.2 [AS4134]', '219.141.140.10', v2.AsnEnricher(), time.monotonic() + 1, True)
        self.assertEqual(hops[0]['asns'], [])
        self.assertEqual(hops[0]['prefixHints'], ['CN2'])
        self.assertEqual(hops[1]['asns'], [4134])
        self.assertNotIn('prefixHints', hops[1])

    def test_native_tcp_argv_fixed_port_ipv4_no_shell_no_implicit_asn_query(self):
        real_spawn = subprocess.Popen
        for protocol in ('udp', 'tcp'):
            def spawn(argv, **options):
                self.assertEqual(argv[-1], helper.TARGETS['beijing'][0])
                self.assertIn('-4', argv)
                self.assertNotIn('-A', argv)
                self.assertFalse(options['shell'])
                self.assertEqual(options['env'], {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
                self.assertEqual(argv[1:4], ['-T', '-p', '443'] if protocol == 'tcp' else ['-4', '-n', '-q'])
                return real_spawn([sys.executable, '-c', "print('1 219.141.140.10 1 ms')"], **options)
            with mock.patch.object(helper.Path, 'is_file', return_value=True), mock.patch.object(subprocess, 'Popen', side_effect=spawn):
                self.assertEqual(helper.execute_trace(helper.TARGETS['beijing'][0], protocol)[1], 'ok')

    def test_cymru_is_off_by_default_and_private_or_ipv6_never_queried(self):
        query = mock.Mock(side_effect=AssertionError('no external query'))
        self.assertEqual(v2.AsnEnricher(query=query).lookup('8.8.8.8', time.monotonic() + 2), [])
        enrich = v2.AsnEnricher(enabled=True, query=query)
        for ip in ['127.0.0.1', '10.0.0.1', '100.64.0.1', '192.0.2.1', '224.0.0.1', '::1', 'not-ip']:
            self.assertEqual(enrich.lookup(ip, time.monotonic() + 2), [])
        query.assert_not_called()

    def test_cymru_success_cache_provenance_and_response_subject_binding(self):
        query = mock.Mock(return_value='AS | IP | BGP Prefix\n4809 | 8.8.8.8 | 8.8.8.0/24\n')
        enrich = v2.AsnEnricher(enabled=True, query=query, clock=lambda: 1000)
        hops, _, _ = v2.parse_trace('1 8.8.8.8\n2 8.8.8.8', '219.141.140.10', enrich, time.monotonic() + 2)
        self.assertEqual([h['asnSource'] for h in hops], ['team-cymru', 'team-cymru'])
        self.assertEqual((enrich.queries, enrich.cache_hits, enrich.failures), (1, 1, 0))
        self.assertEqual(enrich.cache['8.8.8.8']['expires'], 4600)
        mismatch = v2.AsnEnricher(enabled=True, query=lambda *_: '4809 | 1.1.1.1 | prefix')
        self.assertEqual(mismatch.lookup('8.8.8.8', time.monotonic() + 2), [])
        self.assertEqual(mismatch.failures, 1)

    def test_cymru_timeout_malformed_and_oversize_fall_back_and_negative_cache(self):
        for response in ['NA | 8.8.8.8', '0 | 8.8.8.8', '4294967296 | 8.8.8.8', '1 2 3 4 5 | 8.8.8.8', 'x' * 4097, subprocess.TimeoutExpired('fixture', 1)]:
            query = mock.Mock(side_effect=response) if isinstance(response, Exception) else mock.Mock(return_value=response)
            enrich = v2.AsnEnricher(enabled=True, query=query, clock=lambda: 1000)
            with self.subTest(response=str(response)[:40]):
                self.assertEqual(enrich.lookup('8.8.8.8', time.monotonic() + 1), [])
                self.assertEqual(enrich.lookup('8.8.8.8', time.monotonic() + 1), [])
                self.assertEqual((enrich.queries, enrich.failures, enrich.cache_hits), (1, 1, 1))
                self.assertEqual(enrich.cache['8.8.8.8']['expires'], 1300)

    def test_cymru_budget_and_deadline_bound_all_queries(self):
        query = mock.Mock(side_effect=lambda ip, timeout: f'4134 | {ip} | prefix')
        enrich = v2.AsnEnricher(enabled=True, query=query)
        for index in range(1, 12):
            enrich.lookup(f'8.8.8.{index}', time.monotonic() + 2)
        self.assertEqual(query.call_count, 8)
        self.assertTrue(all(0 < args.args[1] <= 2 for args in query.call_args_list))
        enrich.lookup('1.1.1.1', time.monotonic() - 1)
        self.assertEqual(query.call_count, 8)

    def test_whois_wire_request_is_newline_delimited_and_bounded_offline(self):
        wire = mock.MagicMock()
        wire.__enter__.return_value = wire
        wire.recv.side_effect = [b'4809 | 8.8.8.8 | prefix\n', b'']
        output = io.StringIO()
        with mock.patch.object(socket, 'create_connection', return_value=wire) as connect, mock.patch.object(sys, 'argv', ['fixture', '8.8.8.8']), mock.patch.object(sys, 'stdout', output):
            exec(v2.CYMRU_CLIENT, {})
        connect.assert_called_once_with(('whois.cymru.com', 43), timeout=1)
        wire.sendall.assert_called_once_with(b'begin\nverbose\n8.8.8.8\nend\n')
        self.assertIn('4809', output.getvalue())

    def test_query_subprocess_has_timeout_fixed_service_no_secrets_or_shell(self):
        with mock.patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'4134 | 8.8.8.8 | prefix')) as run:
            self.assertIn('4134', v2.query_cymru('8.8.8.8', 1.2))
            args, options = run.call_args
            self.assertEqual(args[0], [sys.executable, '-c', v2.CYMRU_CLIENT, '8.8.8.8'])
            self.assertEqual(options['timeout'], 1.2)
            self.assertFalse(options['shell'])
            self.assertNotIn('TOKEN', options['env'])
        for ip in ['::1', '127.0.0.1']:
            with self.assertRaises(ValueError):
                v2.query_cymru(ip, 1)

    def test_local_configuration_opt_in_consent_types_and_ipv6_rejection(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as directory:
            path = Path(directory, 'config.json')
            base = {'panel': 'https://example.invalid', 'uuid': UUID, 'tokenFile': str(Path(directory, 'token')), 'enabled': True}
            for options in [{'probeProtocols': ['udp', 'tcp']}, {'probeProtocols': ['tcp'], 'cymruEnabled': True, 'cymruConsent': True}, {}]:
                path.write_text(json.dumps({**base, **options})); path.chmod(0o600)
                self.assertEqual(helper.read_config(path, None)['uuid'], UUID)
            for options in [{'probeProtocols': ['tcp'], 'cymruEnabled': True}, {'cymruEnabled': True, 'cymruConsent': True}, {'addressFamily': 6}, {'addressFamily': True}, {'probeProtocols': ['tcp;id']}, {'cymruEnabled': 'yes'}, {'prefixHints': 1}, {'target': '127.0.0.1'}, {'command': 'never'}, {'enabled': False}]:
                path.write_text(json.dumps({**base, **options})); path.chmod(0o600)
                with self.subTest(options=options), self.assertRaises(helper.HelperError):
                    helper.read_config(path, None)

    def test_runtime_reserves_before_probe_persists_cache_and_enforces_restart_cooldown(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as directory:
            token = Path(directory, 'token')
            with v2.runtime(token, helper.private_text) as state:
                runtime_file = token.with_name('route-runtime.json')
                self.assertGreater(json.loads(runtime_file.read_text())['lastProbe'], 0)
                state['cache']['8.8.8.8'] = {'asns': [4809], 'expires': time.time() + 3600}
                self.assertEqual(runtime_file.stat().st_mode & 0o777, 0o600)
                with self.assertRaises(BlockingIOError), v2.runtime(token, helper.private_text):
                    pass
            with self.assertRaises(ValueError), v2.runtime(token, helper.private_text):
                pass
            with mock.patch.object(v2.time, 'time', return_value=state['lastProbe'] + 61), v2.runtime(token, helper.private_text) as restored:
                self.assertEqual(restored['cache']['8.8.8.8']['asns'], [4809])

    def test_service_state_directory_does_not_write_readonly_credential_directory(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as directory:
            root = Path(directory)
            credentials, state = root / 'credentials', root / 'service-state'
            credentials.mkdir(mode=0o700); state.mkdir(mode=0o700)
            credentials.chmod(0o500)
            try:
                with v2.runtime(credentials / 'token', helper.private_text, state):
                    self.assertTrue((state / 'route-runtime.json').is_file())
                    self.assertFalse((credentials / 'route-runtime.json').exists())
                state.chmod(0o755)
                with self.assertRaises(ValueError), v2.runtime(credentials / 'token', helper.private_text, state):
                    pass
            finally:
                credentials.chmod(0o700)

    def test_runtime_rejects_corruption_private_ips_symlinks_and_unsafe_mode(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as directory:
            token = Path(directory, 'token')
            path = token.with_name('route-runtime.json')
            for text, mode in [('not-json', 0o600), ('null', 0o600), (json.dumps({'version': 1, 'lastProbe': 0, 'cache': {'127.0.0.1': {'asns': [4809], 'expires': 1}}}), 0o600), (json.dumps({'version': 1, 'lastProbe': 0, 'cache': {}}), 0o644)]:
                path.write_text(text); path.chmod(mode)
                with self.assertRaises((ValueError, helper.HelperError)), v2.runtime(token, helper.private_text):
                    pass
                self.assertEqual(path.read_text(), text)
            path.unlink(); path.symlink_to(token)
            with self.assertRaises(ValueError), v2.runtime(token, helper.private_text):
                pass

    def test_cycle_uses_new_collector_offline_and_keeps_native_credential_envelope(self):
        job = {'id': 'a' * 48, 'lease': 'b' * 48, 'city': 'beijing', 'leaseUntil': time.time() * 1000 + 180000}
        config = {'uuid': UUID, 'probeProtocols': ['udp', 'tcp'], 'cymruEnabled': True, 'cymruConsent': True}
        with mock.patch.object(helper, 'post', side_effect=[{'schema': 1, 'uuid': UUID, 'job': job}, {'accepted': True}]) as post, mock.patch.object(socket, 'create_connection', side_effect=AssertionError('fixture network forbidden')), mock.patch.object(subprocess, 'Popen', side_effect=AssertionError('fixture process forbidden')):
            self.assertEqual(helper.cycle(config, FIXTURES), 'fixture-accepted')
        endpoint, body = post.call_args.args[1:]
        self.assertEqual(endpoint, '/result')
        self.assertEqual(set(body), {'uuid', 'job_id', 'lease', 'result'})
        self.assertEqual(body['result']['schema'], 2)
        self.assertTrue(all(not r['asnLookup']['enabled'] for rows in body['result']['carriers'].values() for r in rows.values()))

    def test_remote_job_cannot_supply_addresses_protocols_shell_or_nonstring_city(self):
        original = {'id': 'a' * 48, 'lease': 'b' * 48, 'city': 'beijing', 'leaseUntil': time.time() * 1000 + 180000}
        for patch in [{'target': '127.0.0.1'}, {'command': 'never'}, {'protocols': ['tcp']}, {'city': {}}, {'city': '::1'}]:
            with self.subTest(patch=patch), mock.patch.object(helper, 'post', return_value={'schema': 1, 'uuid': UUID, 'job': {**original, **patch}}), self.assertRaises(helper.HelperError):
                helper.cycle({'uuid': UUID, 'probeProtocols': ['tcp']})

    def test_aggregate_result_limit_and_lease_deadline_never_silent_truncation(self):
        def large(target, **options):
            return '\n'.join(f'{i} 8.8.{i}.1 [AS4134] 8.8.{i}.2 [AS4809] 8.8.{i}.3 [AS23764] 8.8.{i}.4 [AS4837]' for i in range(1, 21)), 'ok'
        data = v2.collect(UUID, 'beijing', ['udp', 'tcp'], helper.TARGETS, large)
        self.assertLessEqual(len(json.dumps(data).encode()), v2.MAX_RESULT)
        self.assertTrue(any(row['status'] == 'output-limit' and row['hops'] == [] for values in data['carriers'].values() for row in values.values()))
        runner = mock.Mock(side_effect=AssertionError('expired lease must not probe'))
        expired = v2.collect(UUID, 'beijing', ['tcp'], helper.TARGETS, runner, deadline=time.monotonic() - 1)
        self.assertTrue(all(r['tcp']['status'] == 'timeout' for r in expired['carriers'].values()))
        overflow = v2.parse_trace('1 ' + ' '.join(f'8.8.8.{i}' for i in range(1, 6)), '219.141.140.10', v2.AsnEnricher(), time.monotonic() + 1)
        self.assertEqual(overflow, ([], False, True))


if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ProbeV2Tests))
    output = ROOT / 'test-results/v121/tcpquality/helper-v2.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped), 'realTracerouteExecuted': False, 'realCymruExecuted': False}, indent=2) + '\n')
    raise SystemExit(not result.wasSuccessful())
