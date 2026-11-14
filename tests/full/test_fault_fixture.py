"""Test-only reload archive consistency and unchanged downgrade guard contract."""
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'distribution'))
from enhanced_full.bundle import Bundle, digest
from enhanced_full.deploy import module_action, version_key
from enhanced_full.safety import Refused
from extract_bundle import extract
from fixture_archives import RELOAD_FAULT_MARKER, RELOAD_FAULT_MESSAGE, reload_fault_bundle


class ReloadFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='reload-fixture-', dir=ROOT / 'test-results')
        cls.directory = Path(cls.temporary.name)
        report = json.loads((ROOT / 'test-results/release/artifacts.json').read_text())
        archive = next(r['path'] for r in report['artifacts'] if r['kind'] == 'full-tar-gz')
        extract(archive, cls.directory / 'source')
        cls.bundle = Bundle(cls.directory / 'source', True)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def setUp(self):
        self.output = self.directory / self._testMethodName
        self.fault = reload_fault_bundle(self.bundle, self.output)

    def test_native_manifest_build_and_full_matrix_are_consistent(self):
        before = self.bundle.manifest['modules']['plugin']['version']
        version = self.fault.manifest['modules']['plugin']['version']
        self.assertEqual(version, before.split('+', 1)[0] + '+git.reload-fault-fixture')
        self.assertEqual(module_action({'version': before}, version, 'install'), 'replace-build; ordering-not-inferred')
        content = self.fault.artifact('plugin')
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(json.loads(archive.read('komari-plugin.json'))['version'], version)
            build = json.loads(archive.read('BUILD.json'))
            self.assertEqual(build['version'], version)
            self.assertTrue(build['fixtureOnly'])
            self.assertEqual(build['kind'], 'isolated-reload-fault-fixture')
        row = self.fault.manifest['modules']['plugin']
        self.assertEqual(row['sha256'], digest(content))
        self.assertEqual(self.fault.manifest['files'][row['path']], {'sha256': digest(content), 'bytes': len(content)})

    def test_real_execution_marker_precedes_throw_and_is_not_created_by_builder(self):
        with zipfile.ZipFile(io.BytesIO(self.fault.artifact('plugin'))) as archive:
            script = archive.read('script.js').decode()
        self.assertIn('__storageDir__', script)
        self.assertIn('mode: 0o600', script)
        self.assertLess(script.index('fs.writeFileSync'), script.index('throw new Error'))
        self.assertIn(RELOAD_FAULT_MARKER, script)
        self.assertIn(RELOAD_FAULT_MESSAGE, script)
        self.assertEqual(list(self.directory.rglob(RELOAD_FAULT_MARKER)), [])

    def test_downgrade_and_invalid_version_guards_remain_enforced(self):
        current = self.bundle.manifest['modules']['plugin']['version']
        self.assertIn('downgrade-blocked', module_action({'version': current}, '0.2.0+git.reload-fault-fixture', 'install'))
        self.assertIn('downgrade-blocked', module_action({'version': current}, '0.3.0-trial.1', 'install'))
        self.assertIsNone(version_key('0.3.0-UNREVIEWED'))
        self.assertEqual(module_action({'version': current}, '0.3.0-UNREVIEWED', 'install'), 'unverified-version-blocked')

    def test_only_fault_plugin_is_rewritten_and_corruption_is_rejected(self):
        path = self.fault.manifest['modules']['plugin']['path']
        for name in self.bundle.manifest['files']:
            if name != path:
                self.assertEqual(self.fault.read(name), self.bundle.read(name))
        self.assertNotEqual(self.fault.artifact('plugin'), self.bundle.artifact('plugin'))
        self.assertNotIn('reload-fault', self.bundle.manifest['modules']['plugin']['version'])
        (self.output / path).write_bytes(self.fault.artifact('plugin') + b'CORRUPT')
        with self.assertRaisesRegex(Refused, 'checksum-mismatch'):
            Bundle(self.output, True)


if __name__ == '__main__':
    unittest.main()
