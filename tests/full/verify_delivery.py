"""Verify stable archives and real reports, independent of a Hermes session.

--packages-only is the clean CI gate; full mode also requires fresh local QA
reports. No installation, publishing, credentials, or network access.
"""
import argparse
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'distribution'))
from enhanced_full.bundle import Bundle, helper_members, native_zip
from extract_bundle import extract


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def report(name):
    return json.loads((ROOT / name).read_text())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packages-only', action='store_true')
    args = parser.parse_args()
    assert git('status', '--porcelain=v1') == '', 'delivery requires clean committed source'
    commit, short = git('rev-parse', 'HEAD'), git('rev-parse', '--short', 'HEAD')
    version = report('komari-theme.json')['version']
    artifacts = report('test-results/release/artifacts.json')
    assert artifacts['commit'] == commit and artifacts['dirty'] is False and artifacts['channel'] == 'stable'
    records = {item['kind']: item for item in artifacts['artifacts']}
    assert set(records) == {'full-tar-gz', 'theme', 'plugin', 'helper'}
    for item in records.values():
        path = Path(item['path']).resolve()
        assert path.is_relative_to(ROOT) and path.is_file()
        data = path.read_bytes()
        assert len(data) == item['bytes'] and sha(data) == item['sha256']
    native = Path(records['theme']['path'])
    assert native.name == f'komari-theme-Glassmorphism-build-{short}.zip'
    assert native_zip(native.read_bytes(), 'theme') == report('komari-theme.json')
    transit = (ROOT / 'public/licenses/transit-MIT.txt').read_bytes()
    with zipfile.ZipFile(native) as archive:
        manifest = json.loads(archive.read('komari-theme.json'))
        assert {k: manifest[k] for k in ('name', 'short', 'version', 'author')} == {
            'name': 'Glassmorphism Enhanced', 'short': 'Enhanced', 'version': version, 'author': 'casiuna'}
        assert archive.read('preview.png') == (ROOT / 'docs/preview.png').read_bytes()
        assert archive.read('dist/licenses/transit-MIT.txt') == transit
        expected_dist = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in (ROOT / 'dist').rglob('*') if p.is_file()}
        assert {n for n in archive.namelist() if n.startswith('dist/') and not n.endswith('/')} == set(expected_dist)
        assert all(archive.read(n) == data for n, data in expected_dist.items())
        build = json.loads(archive.read('dist/BUILD.json'))
        assert build['commit'] == commit and build['dirty'] is False and build['version'] == version
        fields = {field.get('key'): field for field in manifest['configuration']['data']}
        assert all(fields[key]['default'] is False for key in ('returnRoutesVisible', 'returnRouteAutoEnabled', 'returnRouteCompanionEnabled'))
    full_path = Path(records['full-tar-gz']['path'])
    assert full_path.name == f'Glassmorphism-Enhanced-Full-{short}.tar.gz'
    with tempfile.TemporaryDirectory(prefix='verify-stable-', dir=ROOT / 'test-results') as temporary:
        directory = extract(full_path, Path(temporary) / 'Full')
        bundle = Bundle(directory)
        assert bundle.manifest['commit'] == commit and bundle.manifest['dirty'] is False
        assert bundle.manifest['version'] == version and bundle.manifest['supportedKomari'] == ['1.6.0']
        assert bundle.manifest['automaticProbeDefault'] is False and bundle.manifest['automaticResultsAccess'] == 'administrator-only'
        for kind in ('theme', 'plugin', 'helper'):
            assert bundle.artifact(kind) == Path(records[kind]['path']).read_bytes()
        assert bundle.read('licenses/transit-MIT.txt') == transit
        assert bundle.read('LICENSE') == (ROOT / 'LICENSE').read_bytes()
        with zipfile.ZipFile(io.BytesIO(bundle.artifact('plugin'))) as plugin:
            assert plugin.read('LICENSE') == transit
        assert helper_members(bundle.artifact('helper'))['LICENSE'] == transit
        inspect = subprocess.run([sys.executable, str(directory / 'manage.py'), 'inspect'], cwd=directory,
                                 text=True, capture_output=True, check=True, env=__import__('os').environ | {'PYTHONDONTWRITEBYTECODE': '1'})
        assert json.loads(inspect.stdout)['commit'] == commit
    result = {'status': 'CLEAN_STABLE_PACKAGES_VERIFIED', 'commit': commit, 'clean': True,
              'artifacts': list(records.values()), 'published': False, 'realTracerouteValidated': False}
    if not args.packages_only:
        counts = {}
        for name, minimum in [('unit', 134), ('browser', 107)]:
            data = report(f'test-results/stable-{name}.json')
            assert data['stats']['expected'] >= minimum and data['errors'] == []
            assert all(data['stats'][key] == 0 for key in ('unexpected', 'skipped', 'flaky'))
            counts[name] = data['stats']['expected']
        for name in ('distribution', 'transport'):
            data = report(f'test-results/full/{name}-unit.json')
            assert data['run'] > 0 and data['failures'] == data['errors'] == data.get('skipped', 0) == 0
            counts[name] = data['run']
        helper = report('test-results/helper-unit.json')
        assert helper['run'] >= 13 and helper['failures'] == helper['errors'] == 0
        counts['helper'] = helper['run']
        junit = ET.parse(ROOT / 'test-results/stable-protocol.xml')
        assert not any(list(junit.iter(tag)) for tag in ('failure', 'error', 'skipped'))
        counts['protocol'] = len(list(junit.iter('testcase')))
        assert counts['protocol'] >= 22
        for name, path, minimum in [('companion', 'test-results/companion-integration.json', 19),
                                    ('full', 'test-results/full/native-integration.json', 28)]:
            data = report(path)
            assert data['failed'] == 0 and data['passed'] == len(data['checks']) >= minimum
            assert all(item['passed'] for item in data['checks'])
            assert data['realTracerouteExecuted'] is False
            counts[name] = data['passed']
            if name == 'full':
                assert data['commit'] == commit and data['dirty'] is False and data['childProcessesExited'] is True
                assert data['previousThemeOfficialAsset'] is True
                assert data['fullSHA256'] == records['full-tar-gz']['sha256']
        result.update(status='STABLE_LOCAL_ACCEPTANCE_VERIFIED', tests=counts)
    output = ROOT / 'test-results/release/delivery-verification.json'
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
