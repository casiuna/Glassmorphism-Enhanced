#!/usr/bin/env python3
"""Create local trial companion artifacts; no network, install or publishing."""
import gzip
import hashlib
import io
import json
import subprocess
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results/trial'
PLUGIN = ['komari-plugin.json', 'script.js', 'protocol.cjs', 'storage.cjs', 'request-limits.cjs', 'LICENSE']
HELPER = ['enhanced_route_helper.py', 'install.py', 'enhanced-route-helper.service', 'enhanced-route-helper.openrc', 'helper.example.json', 'README.md', 'LICENSE']

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain=v1'], cwd=ROOT, text=True).strip())
    metadata = json.dumps({'commit': commit, 'dirty': dirty, 'kind': 'local-trial-only', 'version': '0.1.0'}, sort_keys=True).encode() + b'\n'
    plugin = OUTPUT / 'enhanced-route-probe-0.1.0.zip'
    with zipfile.ZipFile(plugin, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in PLUGIN:
            source = ROOT / 'companion/enhanced-route-probe' / name
            if source.is_symlink() or not source.is_file():
                raise ValueError('missing or unsafe plugin asset')
            archive.writestr(name, source.read_bytes())
        archive.writestr('BUILD.json', metadata)
    helper = OUTPUT / 'enhanced-route-helper-0.1.0.tar.gz'
    with helper.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w') as archive:
        for name in HELPER + ['BUILD.json']:
            source = ROOT / 'companion/helper' / name
            content = metadata if name == 'BUILD.json' else source.read_bytes()
            if name != 'BUILD.json' and source.is_symlink():
                raise ValueError('unsafe helper asset')
            info = tarfile.TarInfo('enhanced-route-helper-0.1.0/' + name)
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
