#!/usr/bin/env python3
"""Build one reproducible Glassmorphism Enhanced stable Full distribution.

The outer delivery asset is a deterministic .tar.gz containing one validated
Full ZIP. It never installs, publishes, contacts a panel, or starts a helper.
"""
import argparse
import gzip
import io
import json
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'distribution'))
from enhanced_full.bundle import Bundle, digest, helper_members, native_zip


RELEASE_CHANNEL = 'stable'
THEME_VERSION = '1.2.0'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def deterministic_zip(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
    return output.getvalue()


def deterministic_outer_tar(filename, inner_zip):
    output = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            info = tarfile.TarInfo(filename)
            info.size = len(inner_zip)
            info.mode = 0o644
            info.mtime = 0
            archive.addfile(info, io.BytesIO(inner_zip))
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--development', action='store_true', help='dirty isolated-test package, never a delivery candidate')
    args = parser.parse_args()
    dirty = bool(git('status', '--porcelain=v1'))
    if dirty and not args.development:
        raise SystemExit('refusing delivery build from dirty source; commit stable source first')
    head, short = git('rev-parse', 'HEAD'), git('rev-parse', '--short', 'HEAD')

    subprocess.check_call([sys.executable, str(ROOT / 'scripts/package-route.py')], cwd=ROOT, stdout=subprocess.DEVNULL)
    plugin_manifest = json.loads((ROOT / 'companion/enhanced-route-probe/komari-plugin.json').read_text())
    helper_manifest = json.loads((ROOT / 'companion/helper/helper-version.json').read_text())
    plugin_base, helper_base = plugin_manifest['version'], helper_manifest['version']
    paths = {
        'theme': ROOT / f'komari-theme-Glassmorphism-build-{short}.zip',
        'plugin': ROOT / f'test-results/release/enhanced-route-probe-{plugin_base}.zip',
        'helper': ROOT / f'test-results/release/enhanced-route-helper-{helper_base}.tar.gz',
    }
    files = {}
    modules = {}
    for kind, path in paths.items():
        content = path.read_bytes()
        info = native_zip(content, kind) if kind != 'helper' else json.loads(helper_members(content)['helper-version.json'])
        name = 'packages/' + path.name
        files[name] = content
        modules[kind] = {'path': name, 'version': info['version'], 'sha256': digest(content), 'bytes': len(content)}
        if kind != 'helper':
            modules[kind]['short'] = info['short']
    expected_theme = json.loads((ROOT / 'komari-theme.json').read_text())['version']
    if expected_theme != THEME_VERSION or modules['theme']['version'] != THEME_VERSION or modules['theme']['short'] != 'Enhanced':
        raise SystemExit('native stable theme package is stale or has the wrong identity')

    installer_files = [
        'manage.py', 'enhanced_full/__init__.py', 'enhanced_full/api.py',
        'enhanced_full/bundle.py', 'enhanced_full/cli.py', 'enhanced_full/deploy.py',
        'enhanced_full/node.py', 'enhanced_full/safety.py',
    ]
    for name in installer_files:
        path = ROOT / 'distribution' / name
        if path.is_symlink():
            raise SystemExit('unsafe distribution source symlink')
        files[name] = path.read_bytes()
    for destination, source in {
        'README.md': 'docs/full.md',
        'VALIDATION.md': 'docs/full-validation.md',
        'LICENSE': 'LICENSE',
        'THIRD_PARTY.md': 'THIRD_PARTY.md',
        'licenses/transit-MIT.txt': 'public/licenses/transit-MIT.txt',
        'docs/return-routes.md': 'docs/return-routes.md',
        'docs/full.md': 'docs/full.md',
        'docs/companion.md': 'docs/companion.md',
        'docs/companion-validation.md': 'docs/companion-validation.md',
        'docs/helper.md': 'companion/helper/README.md',
        'companion/helper/README.md': 'companion/helper/README.md',
        'companion/enhanced-route-probe/LICENSE': 'companion/enhanced-route-probe/LICENSE',
    }.items():
        files[destination] = (ROOT / source).read_bytes()

    manifest = {
        'schema': 1,
        'product': 'Glassmorphism Enhanced',
        'version': THEME_VERSION,
        'channel': RELEASE_CHANNEL,
        'archiveKind': 'full-distribution-inner-zip-not-native-theme-upload',
        'commit': head,
        'dirty': dirty,
        'supportedKomari': ['1.6.0'],
        'dependencies': {
            'installer': 'Python >=3.10,<4 on POSIX',
            'helper': 'Linux; Python >=3.10,<4; traceroute -n -A for LIVE mode only',
            'liveNetwork': 'NOT VALIDATED; fixtures only',
            'serviceManagers': 'systemd/OpenRC templates; not started on development host',
        },
        'modules': modules,
        'automaticProbeDefault': False,
        'automaticResultsAccess': 'administrator-only',
        'nativeShortTermEnrollment': False,
        'realTracerouteValidated': False,
        'files': {name: {'sha256': digest(data), 'bytes': len(data)} for name, data in sorted(files.items())},
    }
    files['full-manifest.json'] = (json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()
    files['SHA256SUMS'] = ''.join(digest(files[name]) + '  ' + name + '\n' for name in sorted(files)).encode()
    inner_zip = deterministic_zip(files)

    with tempfile.TemporaryDirectory(prefix='verify-full-', dir=ROOT / 'test-results') as temporary:
        inner_path = Path(temporary) / 'Full.zip'
        inner_path.write_bytes(inner_zip)
        with zipfile.ZipFile(inner_path) as archive:
            assert archive.testzip() is None
            archive.extractall(Path(temporary) / 'extracted')
        verified = Bundle(Path(temporary) / 'extracted', allow_development=args.development)
        assert verified.manifest == manifest

    output = ROOT / 'test-results/release'
    output.mkdir(parents=True, exist_ok=True)
    package_name = f'Glassmorphism-Enhanced-Full-{short}.tar.gz'
    package = output / package_name
    package.write_bytes(deterministic_outer_tar(f'Glassmorphism-Enhanced-Full-{short}.zip', inner_zip))
    records = [{'kind': 'full-tar-gz', 'path': str(package), 'sha256': digest(package.read_bytes()), 'bytes': package.stat().st_size}]
    records += [{'kind': kind, 'path': str(paths[kind]), 'sha256': module['sha256'], 'bytes': module['bytes']} for kind, module in modules.items()]
    report = {
        'commit': head,
        'dirty': dirty,
        'channel': RELEASE_CHANNEL,
        'status': 'DEVELOPMENT_ONLY' if dirty else 'CLEAN_STABLE_FULL_BUILD',
        'modules': modules,
        'artifacts': records,
        'published': False,
        'productionTouched': False,
        'realTracerouteExecuted': False,
    }
    (output / 'artifacts.json').write_text(json.dumps(report, indent=2) + '\n')
    (output / 'SHA256SUMS').write_text(''.join(record['sha256'] + '  ' + Path(record['path']).name + '\n' for record in records))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
