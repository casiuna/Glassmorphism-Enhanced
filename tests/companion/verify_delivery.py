"""Verify the clean local trial build and ACTUAL test reports. No installs/network."""
import hashlib
import json
import os
import subprocess
import tarfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/trial'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def json_file(path):
    return json.loads((ROOT / path).read_text())

def verify_zip(path):
    z = zipfile.ZipFile(path)
    names = z.namelist()
    assert z.testzip() is None and len(names) == len(set(names))
    assert not any(Path(n).is_absolute() or '..' in Path(n).parts for n in names)
    return z

def main():
    assert os.environ.get('HERMES_SESSION_ID') == '20261019_060547_b240f6'
    assert git('branch', '--show-current') == 'feat/enhanced-tags-return-routes'
    assert git('status', '--porcelain=v1') == ''
    head = git('rev-parse', 'HEAD')
    short = git('rev-parse', '--short', 'HEAD')
    subprocess.check_call(['git', 'merge-base', '--is-ancestor', '328a37100214c7d530fdc107ea9b936b396076b9', head], cwd=ROOT)
    subprocess.check_call(['git', 'diff', 'HEAD', '--check'], cwd=ROOT)
    artifacts = json_file('test-results/trial/artifacts.json')
    assert artifacts['commit'] == head and artifacts['dirty'] is False and artifacts['published'] is False
    records = artifacts['artifacts']
    assert len(records) == 3
    for item in records:
        path = Path(item['path'])
        assert path.is_relative_to(ROOT) and path.is_file()
        assert sha(path.read_bytes()) == item['sha256']
    license_text = (ROOT / 'public/licenses/transit-MIT.txt').read_bytes()
    with verify_zip(ROOT / f'komari-theme-Glassmorphism-build-{short}.zip') as z:
        assert {name.split('/')[0] for name in z.namelist()} == {'komari-theme.json', 'preview.png', 'dist'}
        manifest = json.loads(z.read('komari-theme.json'))
        identity = {k: manifest[k] for k in ['name', 'short', 'version', 'author']}
        assert identity == dict(name='Glassmorphism Enhanced', short='Enhanced', version='1.1.1', author='casiuna')
        assert z.read('preview.png') == (ROOT / 'docs/preview.png').read_bytes()
        assert z.read('dist/licenses/transit-MIT.txt') == license_text
        assert not any('enhanced_route_helper.py' in n or 'komari-plugin.json' in n for n in z.namelist())
        for p in (ROOT / 'dist').rglob('*'):
            if p.is_file():
                assert z.read(p.relative_to(ROOT).as_posix()) == p.read_bytes()
        fields = {field.get('key'): field for field in manifest['configuration']['data']}
        for key in ['returnRoutesVisible', 'returnRouteAutoEnabled', 'returnRouteCompanionEnabled']:
            assert fields[key]['default'] is False
        theme_files = sum(not entry.is_dir() for entry in z.infolist())
    with verify_zip(OUT / 'enhanced-route-probe-0.1.0.zip') as z:
        plugin_manifest = json.loads(z.read('komari-plugin.json'))
        assert plugin_manifest['short'] == 'enhanced-route-probe' and plugin_manifest['version'] == '0.1.0'
        assert plugin_manifest['permissions'] == dict(node=True, allowRoutes=True, maxHTTPBodyBytes=16384, timeout=10)
        assert z.read('LICENSE') == license_text
        build = json.loads(z.read('BUILD.json'))
        assert build['commit'] == head and build['dirty'] is False
    with tarfile.open(OUT / 'enhanced-route-helper-0.1.0.tar.gz') as archive:
        members = archive.getmembers()
        assert len(members) == 8 and all(m.isfile() and not Path(m.name).is_absolute() and '..' not in Path(m.name).parts for m in members)
        def read(name):
            member = archive.extractfile('enhanced-route-helper-0.1.0/' + name)
            assert member is not None
            return member.read()
        assert read('LICENSE') == license_text
        assert json.loads(read('helper.example.json'))['enabled'] is False
        build = json.loads(read('BUILD.json'))
        assert build['commit'] == head and build['dirty'] is False
    unit = json_file('test-results/trial-unit-final.json')
    browser = json_file('test-results/trial-browser-final.json')
    for report, count in [(unit, 120), (browser, 95)]:
        assert report['stats']['expected'] == count
        assert all(report['stats'][key] == 0 for key in ['unexpected', 'skipped', 'flaky'])
        assert report['errors'] == []
    integration = json_file('test-results/companion-integration.json')
    assert integration['passed'] == len(integration['checks']) == 19 and integration['failed'] == 0
    assert integration['realTracerouteExecuted'] is False
    helper = json_file('test-results/helper-unit.json')
    assert helper['run'] == 13 and helper['failures'] == helper['errors'] == 0
    junit = ET.parse(ROOT / 'test-results/trial-protocol.xml')
    assert len(list(junit.iter('testcase'))) == 16
    assert not list(junit.iter('failure')) and not list(junit.iter('error'))
    changed = git('diff', '--name-only', '328a37100214c7d530fdc107ea9b936b396076b9', head).splitlines()
    assert not any(any(part in ['node_modules', 'test-results', '__pycache__', '.env'] for part in Path(name).parts) for name in changed)
    result = {
        'status': 'LOCAL_TRIAL_VERIFIED', 'session': os.environ['HERMES_SESSION_ID'],
        'workspace': str(ROOT), 'branch': git('branch', '--show-current'), 'commit': head,
        'parent': git('rev-parse', 'HEAD^'), 'clean': True, 'files_changed': changed,
        'committed_file_sha256': {name: sha((ROOT / name).read_bytes()) for name in changed},
        'artifacts': records, 'theme_manifest': identity, 'theme_file_count': theme_files,
        'plugin_manifest': plugin_manifest, 'unit': unit['stats'], 'browser': browser['stats'],
        'protocol_tests': 16, 'helper_tests': helper, 'real_backend_integration': integration,
        'published': False, 'production_touched': False, 'real_traceroute_executed': False,
        'limits': ['administrator-only automatic snapshots', 'fixture traces only; live network untested', 'systemd/OpenRC templates not started on host', 'commercial CN2 GT/GIA claims remain candidates', 'no physical GPU telemetry validation'],
    }
    (OUT / 'delivery-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['committed_file_sha256', 'plugin_manifest', 'real_backend_integration']}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
