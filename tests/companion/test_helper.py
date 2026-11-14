import importlib.util
import configparser
import json

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('enhanced_route_helper', ROOT / 'companion/helper/enhanced_route_helper.py')
assert spec is not None and spec.loader is not None
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

class HelperTests(unittest.TestCase):
    def test_fixture_collection_is_explicitly_simulated_and_has_real_parser_evidence(self):
        data = helper.collect('00000000-0000-4000-8000-000000000001', 'beijing', ROOT / 'tests/companion/fixtures')
        self.assertEqual(data['source'], 'fixture')
        self.assertEqual(data['carriers']['telecom']['hops'][0]['asns'], [4134])
        self.assertEqual(data['carriers']['mobile']['status'], 'ok')

    def test_no_ip_prefix_guesses_and_arbitrary_city_rejected(self):
        hops, reached = helper.parse_trace('1 59.43.1.1 1 ms\n2 * * *', '219.141.140.10')
        self.assertEqual(hops[0]['asns'], [])
        self.assertFalse(reached)
        with self.assertRaises(helper.HelperError):
            helper.collect('unused', 'beijing;never-execute')

    def test_legacy_udp_unreachable_target_is_not_successful_reachability(self):
        self.assertFalse(helper.parse_trace('1 219.141.140.10 [AS4134] !H', '219.141.140.10')[1])
        self.assertFalse(helper.parse_trace('1 219.141.140.100 [AS4134]', '219.141.140.10')[1])

    def test_http_remote_redirect_or_credential_urls_rejected(self):
        for value in ['http://example.invalid', 'http://localhost', 'https://user:secret@example.invalid', 'https://example.invalid/?token=never', 'https://example.invalid/path']:
            with self.assertRaises(helper.HelperError):
                helper.panel_url(value, True)
        self.assertEqual(helper.panel_url('http://127.0.0.1:1234', True), 'http://127.0.0.1:1234')
        with self.assertRaises(helper.HelperError):
            helper.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.invalid')

    def test_private_config_mode_owner_and_symlink_checks(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'test-results', prefix='helper-perms-') as directory:
            p = Path(directory, 'private')
            p.write_text('fixture-only-not-a-real-token')
            p.chmod(0o600)
            self.assertEqual(helper.private_text(p, 4096), p.read_text())
            p.chmod(0o644)
            with self.assertRaises(helper.HelperError):
                helper.private_text(p, 4096)
            p.chmod(0o600)
            link = Path(directory, 'link')
            link.symlink_to(p)
            with self.assertRaises(OSError):
                helper.private_text(link, 4096)

    def run_fixed_child(self, program, timeout: float = 25):
        real_spawn = subprocess.Popen
        def spawn(argv, **options):
            self.assertEqual(argv, ['/usr/bin/traceroute', '-4', '-n', '-q', '1', '-w', '1', '-m', '20', '219.141.140.10'])
            self.assertNotIn('-A', argv)  # no unconsented native registry lookup
            self.assertFalse(options['shell'])
            self.assertNotIn('TOKEN', options['env'])
            return real_spawn([sys.executable, '-c', program], **options)
        with mock.patch.object(helper.Path, 'is_file', return_value=True), mock.patch.object(helper.subprocess, 'Popen', side_effect=spawn), mock.patch.object(helper, 'TRACE_TIMEOUT', timeout):
            return helper.execute_trace('219.141.140.10')

    def test_safe_argv_executes_only_fixed_local_child_fixture(self):
        text, status = self.run_fixed_child("print('1 219.141.140.10 [AS4134] 2 ms')")
        self.assertEqual(status, 'ok')
        self.assertIn('[AS4134]', text)

    def test_timeout_kills_local_fixture_process_group(self):
        _, status = self.run_fixed_child('import time; time.sleep(3)', 0.05)
        self.assertEqual(status, 'timeout')

    def test_output_is_bounded(self):
        text, status = self.run_fixed_child("import sys; sys.stdout.write('x'*200000); sys.stdout.flush()")
        self.assertEqual(status, 'output-limit')
        self.assertLessEqual(len(text.encode()), 65536)

    def test_permission_error_is_explicit(self):
        _, status = self.run_fixed_child("import sys; print('Operation not permitted'); sys.exit(1)")
        self.assertEqual(status, 'permission-denied')

    def test_missing_executable_is_explicit(self):
        with mock.patch.object(helper.Path, 'is_file', return_value=False):
            self.assertEqual(helper.execute_trace('219.141.140.10')[1], 'no-traceroute')

    def test_cli_rejects_secret_arguments_without_echoing_values(self):
        run = subprocess.run([sys.executable, str(ROOT / 'companion/helper/enhanced_route_helper.py'), '--token', 'fixture-value-not-to-log'], capture_output=True, text=True)
        self.assertNotEqual(run.returncode, 0)
        self.assertNotIn('fixture-value-not-to-log', run.stdout + run.stderr)

    def test_failed_carriers_never_claim_success(self):
        data = helper.collect('00000000-0000-4000-8000-000000000001', 'beijing', runner=lambda _: ('', 'timeout'))
        self.assertTrue(all(row['status'] == 'timeout' for row in data['carriers'].values()))
        self.assertTrue(all(not row['hops'] for row in data['carriers'].values()))

    def test_installer_upgrade_uninstall_preserves_unrelated_files(self):
        install_spec = importlib.util.spec_from_file_location('installer', ROOT / 'companion/helper/install.py')
        assert install_spec is not None and install_spec.loader is not None
        installer = importlib.util.module_from_spec(install_spec)
        install_spec.loader.exec_module(installer)
        with tempfile.TemporaryDirectory(dir=ROOT / 'test-results', prefix='helper-install-') as directory:
            prefix = Path(directory, '0.1.0')
            installer.install(ROOT / 'companion/helper', prefix)
            with self.assertRaises(ValueError):
                installer.install(ROOT / 'companion/helper', prefix)
            (prefix / 'operator-note').write_text('preserve')
            installer.uninstall(prefix)
            self.assertEqual((prefix / 'operator-note').read_text(), 'preserve')
            self.assertFalse((prefix / 'enhanced_route_helper.py').exists())

    def test_systemd_template_is_unprivileged_and_does_not_contain_credentials(self):
        config = configparser.ConfigParser()
        config.read(ROOT / 'companion/helper/enhanced-route-helper.service')
        self.assertEqual(config['Service']['User'], 'enhanced-route')
        self.assertEqual(config['Service']['CapabilityBoundingSet'], '')
        self.assertEqual(config['Service']['NoNewPrivileges'], 'true')
        self.assertEqual(config['Service']['StateDirectory'], 'enhanced-route-helper')
        self.assertEqual(config['Service']['StateDirectoryMode'], '0700')
        self.assertNotIn('--token', config['Service']['ExecStart'])

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(HelperTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    Path(ROOT / 'test-results/helper-unit.json').write_text(json.dumps({'run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'realTracerouteExecuted': False}, indent=2) + '\n')
    raise SystemExit(not result.wasSuccessful())
