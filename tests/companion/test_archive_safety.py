"""Real archive bytes, explicit negative fixtures; never network or production.

The native lab installer and Full parser must keep the same exact required
asset set. In particular the new v2 module is mandatory, not an optional glob.
"""
import copy
import hashlib
import importlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'distribution'))
bundle = importlib.import_module('enhanced_full.bundle')
HELPER_FILES, helper_members = bundle.HELPER_FILES, bundle.helper_members
Refused = importlib.import_module('enhanced_full.safety').Refused

EXPECTED = frozenset({'enhanced_route_helper.py', 'enhanced_probe_v2.py', 'install.py', 'helper-version.json', 'enhanced-route-helper.service', 'enhanced-route-helper.openrc', 'helper.example.json', 'README.md', 'LICENSE', 'BUILD.json'})


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


native = load('native_archive_guard', 'tests/companion/install_archive.py')
packager = load('helper_package_matrix', 'scripts/package-route.py')
installer = load('helper_file_installer', 'companion/helper/install.py')


class HelperArchiveSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        records = json.loads((ROOT / 'test-results/release/artifacts.json').read_text())['artifacts']
        version = json.loads((ROOT / 'companion/helper/helper-version.json').read_text())['version']
        candidates = [row for row in records if Path(row['path']).name == f'enhanced-route-helper-{version}.tar.gz']
        assert len(candidates) == 1, 'exact versioned helper artifact required'
        archive = Path(candidates[0]['path'])
        cls.data = archive.read_bytes()
        assert hashlib.sha256(cls.data).hexdigest() == candidates[0]['sha256'], 'manifest hash mismatch'
        cls.entries = []
        with tarfile.open(fileobj=io.BytesIO(cls.data), mode='r:gz') as source:
            for item in source.getmembers():
                assert item.isfile()
                asset = source.extractfile(item)
                assert asset is not None
                cls.entries.append((copy.copy(item), asset.read()))
        assert len(cls.entries) == len(EXPECTED)

    @staticmethod
    def archive(entries):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w:gz') as target:
            for item, content in entries:
                item = copy.copy(item)
                item.size = len(content)
                target.addfile(item, io.BytesIO(content))
        return buffer.getvalue()

    def rejected_by_both_before_any_write_or_execution(self, payload):
        with self.assertRaises(Refused):
            helper_members(payload)
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'], prefix='archive-negative-') as directory:
            root = Path(directory)
            package = root / 'malformed.tar.gz'
            package.write_bytes(payload)
            extraction, prefix = root / 'extraction', root / 'installed'
            with mock.patch.object(subprocess, 'run', side_effect=AssertionError('rejected archive must not execute an installer')) as run, self.assertRaisesRegex(ValueError, 'unexpected package assets|non-regular or oversized package asset'):
                native.main(package, extraction, prefix)
            run.assert_not_called()
            self.assertFalse(extraction.exists())
            self.assertFalse(prefix.exists())
            self.assertEqual(set(root.iterdir()), {package})

    def test_exact_required_matrix_is_not_widened_and_v2_is_mandatory(self):
        self.assertEqual(frozenset(HELPER_FILES), EXPECTED)
        self.assertEqual(frozenset(native.ALLOWED), EXPECTED)
        self.assertEqual(frozenset(packager.HELPER) | {'BUILD.json'}, EXPECTED)
        self.assertEqual(frozenset(installer.FILES) | {'install.py', 'BUILD.json'}, EXPECTED)
        self.assertEqual({item.name for item, _ in self.entries}, {native.PREFIX + name for name in EXPECTED})
        self.assertIn('enhanced_probe_v2.py', EXPECTED)

    def test_real_current_archive_validates_without_enabling_probe_or_asn_queries(self):
        values = helper_members(self.data)
        self.assertEqual(set(values), EXPECTED)
        self.assertTrue(values['enhanced_probe_v2.py'].startswith(b'# SPDX-License-Identifier: MIT\n'))
        config = json.loads(values['helper.example.json'])
        self.assertIs(config['enabled'], False)
        self.assertIs(config['cymruEnabled'], False)
        self.assertIs(config['cymruConsent'], False)
        self.assertEqual(config['addressFamily'], 4)

    def test_missing_v2_module_is_rejected_not_treated_as_legacy_package(self):
        entries = [(i, b) for i, b in self.entries if i.name != native.PREFIX + 'enhanced_probe_v2.py']
        self.rejected_by_both_before_any_write_or_execution(self.archive(entries))

    def test_each_required_file_missing_is_rejected_before_installation(self):
        for required in sorted(EXPECTED):
            with self.subTest(required=required):
                entries = [(i, b) for i, b in self.entries if i.name != native.PREFIX + required]
                self.rejected_by_both_before_any_write_or_execution(self.archive(entries))

    def test_unknown_file_append_or_same_count_replacement_is_rejected(self):
        extra = tarfile.TarInfo(native.PREFIX + 'unexpected-command.sh')
        extra.mode = 0o644
        for entries in [self.entries + [(extra, b'offline negative fixture, never execute')], [(i, b) for i, b in self.entries if i.name != native.PREFIX + 'enhanced_probe_v2.py'] + [(extra, b'offline negative fixture')]]:
            with self.subTest(entries=len(entries)):
                self.rejected_by_both_before_any_write_or_execution(self.archive(entries))

    def test_duplicate_nonregular_traversal_and_oversize_entries_are_rejected(self):
        ordinary = [(i, b) for i, b in self.entries if i.name != native.PREFIX + 'enhanced_probe_v2.py']
        original, content = next((i, b) for i, b in self.entries if i.name == native.PREFIX + 'enhanced_probe_v2.py')
        symlink = copy.copy(original)
        symlink.type, symlink.linkname = tarfile.SYMTYPE, '../outside'
        directory = copy.copy(original)
        directory.type = tarfile.DIRTYPE
        traversal = copy.copy(original)
        traversal.name = native.PREFIX + '../outside'
        cases = [self.entries + [self.entries[0]], ordinary + [(symlink, b'')], ordinary + [(directory, b'')], ordinary + [(traversal, b'negative fixture')], ordinary + [(original, b'x' * 1048577)]]
        for index, entries in enumerate(cases):
            with self.subTest(case=index):
                self.rejected_by_both_before_any_write_or_execution(self.archive(entries))

    def test_real_archive_installs_v2_only_into_owned_temporary_prefix(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'], prefix='archive-positive-') as directory:
            root = Path(directory)
            package = root / 'helper.tar.gz'
            package.write_bytes(self.data)
            prefix = root / 'installed'
            native.main(package, root / 'extraction', prefix)
            values = helper_members(self.data)
            for name in installer.FILES:
                self.assertEqual((prefix / name).read_bytes(), values[name])
            marker = json.loads((prefix / installer.MARKER).read_text())
            self.assertEqual(set(marker['files']), set(installer.FILES))
            self.assertFalse((prefix / 'helper.json').exists())
            self.assertFalse((prefix / 'agent-token').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
