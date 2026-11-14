"""Offline behavior tests against real built archives and an explicit fake API.

FakeAPI is a unit fixture, never evidence of native compatibility. Native API,
process and browser coverage is in tests/full/integration.mjs.
"""
import copy
import gzip
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'distribution'))
from enhanced_full.api import API, ROOT as API_ROOT, SHORT, THEME
from enhanced_full.bundle import Bundle, digest, helper_members, native_zip, safe_name
from enhanced_full.deploy import deploy, load_journal, restore, snapshot
from enhanced_full.node import enroll, uninstall_node
from enhanced_full.safety import Refused, origin, private_bytes, private_directory, save_private
from extract_bundle import extract

UUID = '00000000-0000-4000-8000-000000000001'
OTHER = '00000000-0000-4000-8000-000000000002'

class FakeAPI:
    """Deliberately a unit fixture: supports failure-after-write and conflicts."""
    panel = 'http://127.0.0.1:12345'
    def __init__(self):
        self.version = '1.6.0'
        self.active = 'default'
        self.themes = {}
        self.settings = {'default': {'unrelatedTheme': 'PRESERVE'}, THEME: {'transitCarrierPingRules': 'KEEP', 'currency': 'SGD', 'unknownFuture': {'keep': True}}}
        self.plugin = None
        self.config = None
        self.state = {'schema': 1, 'nodes': {}}
        self.writes = []
        self.fail: str | None = None
        self.fail_always = False
        self.drift = False
        self.public_reads = 0
        self.unhealthy = False
        self.emulate_native_plugin_defaults = False
        self.plugin_defaults = {}
    def rpc(self, method, params=None):
        params = params or {}
        if method == 'public:getVersion':
            return {'version': self.version}
        if method == 'public:getPublicSettings':
            self.public_reads += 1
            if self.drift and self.public_reads == 2:
                self.active = 'another-theme'
            return copy.deepcopy({'theme': self.active, 'theme_settings': self.settings.get(self.active, {})})
        if method == 'admin:listPlugins':
            return [copy.deepcopy(self.plugin)] if self.plugin else []
        if method == 'admin:getPluginConfiguration':
            return {'data': copy.deepcopy(self.config)}
        if method == 'admin:deletePlugin':
            self.writes.append('delete-plugin')
            self.plugin, self.config, self.state = None, None, {'schema': 1, 'nodes': {}}
            return None
        raise AssertionError('unsupported fixture RPC')
    def rest(self, path, data=None):
        if path == '/api/admin/theme/list':
            return copy.deepcopy(list(self.themes.values()))
        if path == '/api/admin/theme/delete':
            self.writes.append('delete-theme')
            self.themes.pop(data['short'], None)
            return None
        if path == '/api/admin/theme/settings?theme=' + THEME and data is not None:
            self.writes.append('theme-settings')
            self.settings[THEME] = copy.deepcopy(data)
            return None
        raise AssertionError('unsupported fixture REST')
    def plugin_config(self):
        if self.emulate_native_plugin_defaults:
            return copy.deepcopy({**self.plugin_defaults, **(self.config or {})})
        return copy.deepcopy(self.config)
    def set_config(self, config):
        self.writes.append('config')
        self.config = copy.deepcopy(config)
    def enabled(self, enabled, approved=False):
        self.writes.append('enable' if enabled else 'disable')
        if self.fail_always:
            raise Refused('fixture-permanent-native-failure')
        self.plugin['enabled'] = enabled
    def activate(self, short):
        self.writes.append('activate')
        self.active = short
    def upload(self, kind, content):
        self.writes.append('upload-' + kind)
        info = native_zip(content, kind, allow_legacy=True)
        if kind == 'theme':
            self.themes[info['short']] = {'short': info['short'], 'version': info['version']}
            defaults = {f['key']: f['default'] for f in info['configuration']['data'] if f.get('key') and 'default' in f}
            self.settings[THEME] = {**defaults, **self.settings.get(THEME, {})}
        else:
            was = self.plugin['enabled'] if self.plugin else False
            self.plugin = {'short': SHORT, 'version': info['version'], 'enabled': was}
            self.plugin_defaults = {f['key']: f['default'] for f in info['configuration']['data'] if f.get('key') and 'default' in f}
            if self.config is None:
                self.config = {'enabled': False, 'nodes': '{}'}
        if self.fail == kind:
            self.fail = None
            raise Refused('fixture-failed-after-upload-committed')
    def json(self, path, data=None):
        if path == API_ROOT + '/health':
            return {'schema': 1, 'version': self.plugin['version'], 'storage': 'unavailable' if self.unhealthy else 'healthy'}
        if path == API_ROOT + '/checkpoint':
            return copy.deepcopy(self.state)
        if path == API_ROOT + '/restore-node':
            if self.config['enabled']:
                raise Refused('fixture-restore-policy-not-disabled')
            self.writes.append('restore-node')
            self.state['nodes'][data['uuid']] = copy.deepcopy(data['node'])
            return {'restored': True}
        raise AssertionError('unsupported fixture private route')

class DistributionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        report_path = ROOT / 'test-results/release/artifacts.json'
        report = json.loads(report_path.read_text())
        package = Path(next(a['path'] for a in report['artifacts'] if a['kind'] == 'full-tar-gz'))
        cls.runtime = tempfile.TemporaryDirectory(prefix='full-unit-', dir=ROOT / 'test-results/full')
        cls.base = Path(cls.runtime.name)
        cls.distribution = cls.base / 'bundle'
        extract(package, cls.distribution)
        cls.bundle = Bundle(cls.distribution, allow_development=True)
    @classmethod
    def tearDownClass(cls):
        cls.runtime.cleanup()
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='case-', dir=self.base)
        self.directory = Path(self.temporary.name)
        self.api = FakeAPI()
    def tearDown(self):
        self.temporary.cleanup()
    def apply(self, **kwargs):
        return deploy(self.api, self.bundle, apply=True, approve=True, backup_dir=self.directory / 'backup', **kwargs)
    def installed(self):
        self.apply(activate=True)
        self.api.writes.clear()
    def old_archive(self, kind):
        data = self.bundle.artifact(kind)
        output = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as target:
            manifest_name = 'komari-theme.json' if kind == 'theme' else 'komari-plugin.json'
            for item in source.infolist():
                content = source.read(item.filename)
                if item.filename == manifest_name:
                    value = json.loads(content)
                    value['version'] = '1.1.1' if kind == 'theme' else '0.1.0'
                    if kind == 'theme':
                        new_fields = {'customTagsVisible', 'returnRouteAutoEnabled', 'returnRouteCompanionEnabled', 'returnRouteConfig', 'returnRouteTtlHours', 'returnRoutesVisible', 'trafficCycleConfig'}
                        value['configuration']['data'] = [f for f in value['configuration']['data'] if f.get('key') not in new_fields]
                    else:
                        value['configuration']['data'] = [f for f in value['configuration']['data'] if f.get('key') != 'cdnTargets']
                    content = json.dumps(value).encode()
                target.writestr(item, content)
        path = self.directory / (kind + '-old-fixture.zip')
        path.write_bytes(output.getvalue())
        self.api.upload(kind, path.read_bytes())
        return path
    def test_real_bundle_layout_hashes_versions_and_notices(self):
        for kind in ('theme', 'plugin'):
            info = native_zip(self.bundle.artifact(kind), kind)
            self.assertEqual(info['version'], self.bundle.manifest['modules'][kind]['version'])
        members = helper_members(self.bundle.artifact('helper'))
        self.assertFalse(json.loads(members['helper.example.json'])['enabled'])
        notice = self.bundle.read('licenses/transit-MIT.txt')
        self.assertIn(b'Copyright (c) 2026 yyy622hhh', notice)
        self.assertIn(b'Copyright (c) 2025 Tony Liu', notice)
        self.assertEqual(members['LICENSE'], notice)
    def test_native_theme_is_not_full_archive_and_has_stable_identity(self):
        self.assertEqual(native_zip(self.bundle.artifact('theme'), 'theme')['short'], THEME)
        self.assertEqual(native_zip(self.bundle.artifact('theme'), 'theme')['version'], self.bundle.manifest['version'])
    def test_dirty_package_rejected_without_explicit_development_test_mode(self):
        if self.bundle.manifest['dirty']:
            with self.assertRaises(Refused):
                Bundle(self.distribution)
        else:
            self.assertEqual(Bundle(self.distribution).manifest['dirty'], False)
    def test_modified_payload_is_rejected(self):
        copied = self.directory / 'tampered'
        shutil.copytree(self.distribution, copied)
        (copied / 'LICENSE').write_text('tampered')
        with self.assertRaises(Refused):
            Bundle(copied, True)
    def test_unexpected_file_or_symlink_is_rejected(self):
        copied = self.directory / 'extra'
        shutil.copytree(self.distribution, copied)
        (copied / 'private-session').symlink_to(self.distribution / 'LICENSE')
        with self.assertRaises(Refused):
            Bundle(copied, True)
    def test_archive_traversal_and_aliases_are_rejected(self):
        for name in ['../escape', '/absolute', 'a/../escape', 'C:/escape', 'a\\escape', './alias', 'a//b']:
            with self.subTest(name=name), self.assertRaises(Refused):
                safe_name(name)
    def test_default_dry_run_has_zero_application_or_file_writes(self):
        before = copy.deepcopy(self.api.__dict__)
        result = deploy(self.api, self.bundle)
        self.assertEqual(result['mode'], 'dry-run')
        self.assertEqual(self.api.writes, [])
        self.assertEqual(self.api.themes, before['themes'])
        self.assertEqual(list(self.directory.iterdir()), [])
    def test_apply_requires_explicit_permission_and_private_backup(self):
        with self.assertRaises(Refused):
            deploy(self.api, self.bundle, apply=True)
        with self.assertRaises(Refused):
            deploy(self.api, self.bundle, apply=True, approve=True)
        self.assertEqual(self.api.writes, [])
    def test_unsupported_backend_refuses_before_any_write(self):
        self.api.version = '1.5.1'
        with self.assertRaises(Refused):
            self.apply()
        self.assertEqual(self.api.writes, [])
    def test_install_preserves_formal_theme_configuration_and_defaults_off(self):
        old = copy.deepcopy(self.api.settings['Enhanced'])
        result = self.apply(activate=True)
        self.assertIn('readback-verified', result['status'])
        self.assertEqual(self.api.active, THEME)
        self.assertEqual({k: self.api.settings[THEME][k] for k in old}, old)
        self.assertEqual(self.api.themes['Enhanced']['version'], self.bundle.manifest['version'])
        self.assertFalse(self.api.config['enabled'])
    def test_idempotent_install_does_not_upload_rewrite_or_create_a_backup(self):
        self.installed()
        result = deploy(self.api, self.bundle, apply=True, approve=True, backup_dir=self.directory / 'unused', activate=True)
        self.assertIn('no-writes', result['status'])
        self.assertEqual(self.api.writes, [])
        self.assertFalse((self.directory / 'unused').exists())
    def test_v111_upgrade_requires_old_theme_and_preserves_config_through_rollback(self):
        previous = self.old_archive('theme')
        self.api.active = THEME
        self.api.writes.clear()
        before = snapshot(self.api)
        with self.assertRaisesRegex(Refused, 'previous-theme-archive-required'):
            self.apply(activate=True)
        self.assertEqual(self.api.writes, [])
        self.apply(previous={'theme': previous}, activate=True)
        self.assertEqual(self.api.themes[THEME]['version'], self.bundle.manifest['version'])
        current = snapshot(self.api)['activeThemeSettings']
        self.assertEqual({k: current[k] for k in before['activeThemeSettings']}, before['activeThemeSettings'])
        self.assertIs(current['returnRouteAutoEnabled'], False)
        directory, journal = load_journal(self.directory / 'backup', self.api)
        self.assertIn('readback-verified', restore(self.api, self.bundle, directory, journal))
        self.assertEqual(snapshot(self.api), before)
    def test_new_version_requires_matching_previous_archive_before_any_write(self):
        self.old_archive('plugin')
        self.api.writes.clear()
        with self.assertRaises(Refused):
            self.apply()
        self.assertEqual(self.api.writes, [])
    def test_old_archive_version_mismatch_refuses_before_any_write(self):
        path = self.old_archive('plugin')
        self.api.plugin['version'] = '0.0.9'
        self.api.writes.clear()
        with self.assertRaises(Refused):
            self.apply(previous={'plugin': path})
        self.assertEqual(self.api.writes, [])
    def test_upgrade_preserves_existing_policy_disabled_state_and_private_results(self):
        old = self.old_archive('plugin')
        self.api.config = {'enabled': True, 'nodes': json.dumps({UUID: {'enabled': True, 'city': 'beijing', 'periodMinutes': 360}})}
        self.api.state = {'schema': 1, 'nodes': {UUID: {'seenAt': 1000, 'lastStarted': 0, 'job': None, 'latest': None}}}
        before = copy.deepcopy((self.api.config, self.api.state))
        self.apply(previous={'plugin': old})
        self.assertEqual((self.api.config, self.api.state), before)
        assert isinstance(self.api.plugin, dict)
        self.assertFalse(self.api.plugin['enabled'])
        self.assertEqual(self.api.plugin['version'], self.bundle.manifest['modules']['plugin']['version'])

    def test_native_added_plugin_defaults_preserve_policy_and_allow_exact_rollback(self):
        self.api.emulate_native_plugin_defaults = True
        old = self.old_archive('plugin')
        self.api.config = {'enabled': True, 'nodes': '{}'}
        before = snapshot(self.api)
        self.apply(previous={'plugin': old})
        defaults = {f['key']: f['default'] for f in native_zip(self.bundle.artifact('plugin'), 'plugin')['configuration']['data'] if f.get('key') and 'default' in f}
        self.assertEqual(self.api.plugin_config(), {**defaults, **before['config']})
        directory, journal = load_journal(self.directory / 'backup', self.api)
        restore(self.api, self.bundle, directory, journal)
        self.assertEqual(snapshot(self.api), before)

    def test_native_added_defaults_failure_after_upload_rolls_back_without_weakening_conflicts(self):
        self.api.emulate_native_plugin_defaults = True
        old = self.old_archive('plugin')
        before = snapshot(self.api)
        self.api.fail = 'plugin'
        with self.assertRaisesRegex(Refused, 'rolled-back-and-readback-verified'):
            self.apply(previous={'plugin': old})
        self.assertEqual(snapshot(self.api), before)

    def test_native_default_field_changed_by_another_admin_still_blocks_rollback(self):
        self.api.emulate_native_plugin_defaults = True
        old = self.old_archive('plugin')
        self.apply(previous={'plugin': old})
        directory, journal = load_journal(self.directory / 'backup', self.api)
        assert isinstance(self.api.config, dict)
        self.api.config['cdnTargets'] = '{"unreviewed":"not-the-default"}'
        before_conflict = snapshot(self.api)
        with self.assertRaisesRegex(Refused, 'rollback-configuration-conflict'):
            restore(self.api, self.bundle, directory, journal)
        self.assertEqual(snapshot(self.api), before_conflict)

    def test_native_defaults_fresh_install_failure_still_removes_only_owned_modules(self):
        self.api.emulate_native_plugin_defaults = True
        before = snapshot(self.api)
        self.api.fail = 'plugin'
        with self.assertRaisesRegex(Refused, 'rolled-back-and-readback-verified'):
            self.apply()
        self.assertEqual(snapshot(self.api), before)

    def test_failure_after_committed_upload_compensates_and_verifies(self):
        old = self.old_archive('plugin')
        before = snapshot(self.api)
        self.api.fail = 'plugin'
        with self.assertRaisesRegex(Refused, 'rolled-back-and-readback-verified'):
            self.apply(previous={'plugin': old}, activate=True)
        self.assertEqual(snapshot(self.api), before)
        _, journal = load_journal(self.directory / 'backup', self.api)
        self.assertEqual(journal['status'], 'rolled-back')
    def test_prewrite_concurrent_change_is_not_overwritten(self):
        self.api.drift = True
        with self.assertRaisesRegex(Refused, 'preflight-state-changed'):
            self.apply()
        self.assertEqual(self.api.writes, [])
        self.assertEqual(self.api.active, 'another-theme')
    def test_v111_failed_upgrade_restores_added_defaults_and_original_values_exactly(self):
        theme = self.old_archive('theme')
        plugin = self.old_archive('plugin')
        self.api.active = THEME
        before = snapshot(self.api)
        self.api.fail = 'plugin'
        with self.assertRaisesRegex(Refused, 'rolled-back-and-readback-verified'):
            self.apply(previous={'theme': theme, 'plugin': plugin}, activate=True)
        self.assertEqual(snapshot(self.api), before)
    def test_rollback_does_not_confuse_an_admin_edit_with_new_manifest_defaults(self):
        theme = self.old_archive('theme')
        self.api.active = THEME
        self.apply(previous={'theme': theme}, activate=True)
        self.api.settings[THEME]['returnRouteTtlHours'] = 48
        directory, journal = load_journal(self.directory / 'backup', self.api)
        with self.assertRaisesRegex(Refused, 'theme-settings-conflict'):
            restore(self.api, self.bundle, directory, journal)
        self.assertEqual(self.api.settings[THEME]['returnRouteTtlHours'], 48)
    def test_rollback_detects_foreign_configuration_and_preserves_it(self):
        self.installed()
        self.api.config = {'enabled': True, 'nodes': '{}'}
        directory, journal = load_journal(self.directory / 'backup', self.api)
        with self.assertRaisesRegex(Refused, 'configuration-conflict'):
            restore(self.api, self.bundle, directory, journal)
        self.assertTrue(self.api.config['enabled'])
    def test_backup_modes_and_tamper_check_before_restore(self):
        self.installed()
        directory = self.directory / 'backup'
        self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
        self.assertEqual((directory / 'journal.json').stat().st_mode & 0o777, 0o600)
        save_private(directory / 'journal.json', {**json.loads(private_bytes(directory / 'journal.json')), 'files': {'previous-plugin.zip': '0' * 64}})
        with self.assertRaises((Refused, OSError)):
            load_journal(directory, self.api)
    def test_uninstall_requires_stopped_helpers_acknowledgment(self):
        self.installed()
        with self.assertRaises(Refused):
            deploy(self.api, self.bundle, operation='uninstall', apply=True, approve=True, backup_dir=self.directory / 'uninstall')
        self.assertEqual(self.api.writes, [])
    def test_uninstall_and_rollback_restore_private_results_settings_and_original_theme(self):
        self.installed()
        self.api.state = {'schema': 1, 'nodes': {UUID: {'seenAt': 1000, 'lastStarted': 0, 'job': None, 'latest': None, 'helperVersion': '0.2.0'}}}
        self.api.config = {'enabled': True, 'nodes': json.dumps({UUID: {'enabled': True, 'city': 'beijing', 'periodMinutes': 360}})}
        original, private_state = snapshot(self.api), copy.deepcopy(self.api.state)
        directory = self.directory / 'uninstall'
        deploy(self.api, self.bundle, operation='uninstall', apply=True, approve=True, backup_dir=directory, helpers_stopped=True)
        self.assertIsNone(self.api.plugin)
        self.assertNotIn(THEME, self.api.themes)
        self.assertEqual(self.api.active, 'default')
        directory, journal = load_journal(directory, self.api)
        self.assertIn('readback-verified', restore(self.api, self.bundle, directory, journal))
        self.assertEqual(snapshot(self.api), original)
        self.assertEqual(self.api.state, private_state)
    def test_private_file_modes_and_symlinks_refuse(self):
        path = self.directory / 'secret'
        path.write_text('unit-only-noncredential')
        path.chmod(0o644)
        with self.assertRaises(Refused):
            private_bytes(path)
        path.chmod(0o600)
        link = self.directory / 'link'
        link.symlink_to(path)
        with self.assertRaises(OSError):
            private_bytes(link)
    def test_origin_credentials_paths_query_and_insecure_remote_are_rejected(self):
        for panel in ['http://panel.example', 'https://user:private@panel.example', 'https://panel.example?token=private', 'https://panel.example/base', 'https://panel.example/#fragment', 'https://panel.example:0', 'https://panel.example\n']:
            with self.subTest(panel=panel), self.assertRaises(Refused):
                origin(panel, True)
        self.assertEqual(origin('http://127.0.0.1:12345', True), self.api.panel)
        with self.assertRaises(Refused):
            origin('http://localhost:12345', True)
    def test_unknown_secret_cli_option_is_redacted(self):
        sentinel = 'unit-only-never-print-this-value'
        child = subprocess.run([sys.executable, str(ROOT / 'distribution/manage.py'), 'inspect', '--token', sentinel], capture_output=True, text=True)
        self.assertNotEqual(child.returncode, 0)
        self.assertTrue(sentinel not in child.stdout + child.stderr)
    def test_node_default_dry_run_sends_no_identity_and_creates_no_files(self):
        config = self.directory / 'node-agent.json'
        save_private(config, {'endpoint': self.api.panel, 'token': 'unit-only-private-node-credential'})
        with patch('enhanced_full.node.API') as transport:
            result = enroll(self.bundle, self.api.panel, UUID, config, self.directory / 'code', self.directory / 'state', allow_loopback=True)
            transport.assert_not_called()
        self.assertEqual(result['mode'], 'dry-run')
        self.assertFalse((self.directory / 'code').exists())
        self.assertFalse((self.directory / 'state').exists())
    def test_node_refuses_origin_or_uuid_impersonation_before_local_install(self):
        config = self.directory / 'node-agent.json'
        save_private(config, {'endpoint': 'https://different.example', 'token': 'unit-only-private-node-credential'})
        with patch('enhanced_full.node.API') as transport, self.assertRaises(Refused):
            enroll(self.bundle, self.api.panel, UUID, config, self.directory / 'code', self.directory / 'state', apply=True, allow_loopback=True)
        transport.assert_not_called()
        self.assertFalse((self.directory / 'state').exists())
        save_private(config, {'endpoint': self.api.panel, 'token': 'unit-only-private-node-credential'})
        with patch('enhanced_full.node.API') as transport:
            transport.return_value.json.return_value = {'registered': True, 'uuid': OTHER}
            with self.assertRaises(Refused):
                enroll(self.bundle, self.api.panel, UUID, config, self.directory / 'code', self.directory / 'state', apply=True, allow_loopback=True)
        self.assertFalse((self.directory / 'code').exists())
    def test_node_install_idempotence_permissions_agent_preservation_and_owned_uninstall(self):
        config = self.directory / 'node-agent.json'
        save_private(config, {'endpoint': self.api.panel, 'token': 'unit-only-private-node-credential', 'unknownAgentSetting': 'PRESERVE'})
        original = config.read_bytes()
        prefix, state = self.directory / 'code', self.directory / 'state'
        with patch('enhanced_full.node.API') as transport:
            transport.return_value.json.return_value = {'registered': True, 'uuid': UUID}
            for _ in range(2):
                enroll(self.bundle, self.api.panel, UUID, config, prefix, state, apply=True, allow_loopback=True, enable_local=True)
        self.assertEqual(config.read_bytes(), original)
        self.assertEqual((state / 'helper.json').stat().st_mode & 0o777, 0o600)
        self.assertEqual((state / 'agent-token').stat().st_mode & 0o777, 0o600)
        self.assertEqual(state.stat().st_mode & 0o777, 0o700)
        (prefix / 'operator-note.txt').write_text('keep')
        uninstall_node(self.bundle, prefix, state, apply=True, helper_stopped=True)
        self.assertTrue((prefix / 'operator-note.txt').exists())
        self.assertTrue((state / 'agent-token').is_file())
        self.assertFalse((prefix / 'enhanced_route_helper.py').exists())

    def test_node_upgrade_preserves_local_protocol_and_external_query_consent(self):
        agent_config = self.directory / 'agent.json'
        save_private(agent_config, {'endpoint': self.api.panel, 'token': 'unit-only-private-node-credential', 'unknownAgentSetting': 'KEEP'})
        original = agent_config.read_bytes()
        prefix, state = self.directory / 'code', self.directory / 'state'
        with patch('enhanced_full.node.API') as transport:
            transport.return_value.json.return_value = {'registered': True, 'uuid': UUID}
            enroll(self.bundle, self.api.panel, UUID, agent_config, prefix, state, apply=True, allow_loopback=True)
        options = {'probeProtocols': ['tcp', 'udp'], 'addressFamily': 4, 'cymruEnabled': True, 'cymruConsent': True, 'prefixHints': True}
        config = json.loads(private_bytes(state / 'helper.json')) | options
        save_private(state / 'helper.json', config)
        with patch('enhanced_full.node.API') as transport:
            transport.return_value.json.return_value = {'registered': True, 'uuid': UUID}
            enroll(self.bundle, self.api.panel, UUID, agent_config, self.directory / 'new-code', state, apply=True, allow_loopback=True)
        self.assertEqual(json.loads(private_bytes(state / 'helper.json')), config)
        self.assertEqual(agent_config.read_bytes(), original)
        # Unknown options/commands still refuse before a registration or write.
        save_private(state / 'helper.json', config | {'command': 'never-execute'})
        before = (state / 'helper.json').read_bytes()
        with patch('enhanced_full.node.API') as transport, self.assertRaises(Refused):
            enroll(self.bundle, self.api.panel, UUID, agent_config, prefix, state, apply=True, allow_loopback=True)
        transport.assert_not_called()
        self.assertEqual((state / 'helper.json').read_bytes(), before)

    def test_same_version_unhealthy_plugin_is_not_reported_as_success(self):
        self.installed()
        self.api.unhealthy = True
        with self.assertRaisesRegex(Refused, 'health-or-version'):
            deploy(self.api, self.bundle, apply=True, approve=True, backup_dir=self.directory / 'unused', activate=True)
        self.assertEqual(self.api.writes, [])

    def test_newer_or_unverifiable_installed_versions_refuse_downgrade_before_any_write(self):
        self.old_archive('plugin')
        self.api.writes.clear()
        for version in ['9.0.0', 'development-unknown']:
            self.api.plugin['version'] = version
            with self.assertRaisesRegex(Refused, 'downgrade-blocked'):
                self.apply()
            self.assertEqual(self.api.writes, [])

    def test_node_existing_unowned_or_symlink_prefix_refuses_before_registration(self):
        config = self.directory / 'node-agent.json'
        save_private(config, {'endpoint': self.api.panel, 'token': 'unit-only-private-node-credential'})
        existing = self.directory / 'existing'
        existing.mkdir()
        (existing / 'operator-data.txt').write_text('preserve')
        with patch('enhanced_full.node.API') as transport, self.assertRaises(Refused):
            enroll(self.bundle, self.api.panel, UUID, config, existing, self.directory / 'state', apply=True, allow_loopback=True)
        transport.assert_not_called()
        self.assertEqual((existing / 'operator-data.txt').read_text(), 'preserve')
        link = self.directory / 'link'
        link.symlink_to(existing, target_is_directory=True)
        with patch('enhanced_full.node.API') as transport, self.assertRaises(Refused):
            enroll(self.bundle, self.api.panel, UUID, config, link / 'escape', self.directory / 'state', apply=True, allow_loopback=True)
        transport.assert_not_called()
        self.assertFalse((existing / 'escape').exists())

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(DistributionTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {'kind': 'offline-unit-real-archives-with-explicit-fake-api', 'run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped), 'realTracerouteExecuted': False}
    (ROOT / 'test-results/full/distribution-unit.json').write_text(json.dumps(report, indent=2) + '\n')
    sys.exit(not result.wasSuccessful())
