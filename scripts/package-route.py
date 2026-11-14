#!/usr/bin/env python3
"""Create stable companion artifacts; no network, install or publishing."""
import gzip
import hashlib
import io
import json
import subprocess
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results/release'
PLUGIN = ['komari-plugin.json', 'script.js', 'protocol.cjs', 'storage.cjs', 'request-limits.cjs', 'LICENSE']
HELPER = ['enhanced_route_helper.py', 'enhanced_probe_v2.py', 'install.py', 'helper-version.json', 'enhanced-route-helper.service', 'enhanced-route-helper.openrc', 'helper.example.json', 'README.md', 'LICENSE']

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    short = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain=v1'], cwd=ROOT, text=True).strip())
    plugin_manifest = json.loads((ROOT / 'companion/enhanced-route-probe/komari-plugin.json').read_text())
    helper_manifest = json.loads((ROOT / 'companion/helper/helper-version.json').read_text())
    plugin_base, helper_base = plugin_manifest['version'], helper_manifest['version']
    plugin_manifest['version'] += '+git.' + short
    helper_manifest['version'] += '+git.' + short
    def metadata(version):
        return json.dumps({'commit': commit, 'dirty': dirty, 'kind': 'stable-release', 'channel': 'stable', 'version': version}, sort_keys=True).encode() + b'\n'
    plugin = OUTPUT / f'enhanced-route-probe-{plugin_base}.zip'
    with zipfile.ZipFile(plugin, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in PLUGIN:
            source = ROOT / 'companion/enhanced-route-probe' / name
            if source.is_symlink() or not source.is_file():
                raise ValueError('missing or unsafe plugin asset')
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, json.dumps(plugin_manifest, indent=2).encode() + b'\n' if name == 'komari-plugin.json' else source.read_bytes())
        info = zipfile.ZipInfo('BUILD.json', date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, metadata(plugin_manifest['version']))
    helper = OUTPUT / f'enhanced-route-helper-{helper_base}.tar.gz'
    with helper.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w') as archive:
        for name in HELPER + ['BUILD.json']:
            source = ROOT / 'companion/helper' / name
            content = metadata(helper_manifest['version']) if name == 'BUILD.json' else json.dumps(helper_manifest).encode() + b'\n' if name == 'helper-version.json' else source.read_bytes()
            if name != 'BUILD.json' and source.is_symlink():
                raise ValueError('unsafe helper asset')
            info = tarfile.TarInfo(f'enhanced-route-helper-{helper_base}/' + name)
            info.size = len(content)
            info.mode = 0o755 if name.endswith('.openrc') else 0o644
            info.mtime = 0
            archive.addfile(info, io.BytesIO(content))
    assets = [plugin, helper]
    theme = ROOT / ('komari-theme-Glassmorphism-build-' + subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip() + '.zip')
    if theme.is_file():
        assets.append(theme)
    records = [{'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size} for path in assets]
    report = {'commit': commit, 'dirty': dirty, 'artifacts': records, 'published': False}
    (OUTPUT / 'artifacts.json').write_text(json.dumps(report, indent=2) + '\n')
    (OUTPUT / 'SHA256SUMS').write_text(''.join(row['sha256'] + '  ' + Path(row['path']).name + '\n' for row in records))
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
