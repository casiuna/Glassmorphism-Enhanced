"""Validate and file-install OUR locally built helper archive in a private lab.
Not an arbitrary archive installer, service starter, credential reader or updater.
"""
import json
import subprocess
import sys
import tarfile
from pathlib import Path

ALLOWED = {'enhanced_route_helper.py', 'install.py', 'enhanced-route-helper.service', 'enhanced-route-helper.openrc', 'helper.example.json', 'README.md', 'LICENSE', 'BUILD.json'}
PREFIX = 'enhanced-route-helper-0.1.0/'

def main(archive, extraction, prefix):
    extraction = Path(extraction)
    if extraction.exists() or Path(prefix).exists():
        raise ValueError('new lab directories required')
    with tarfile.open(archive, 'r:gz') as package:
        members = package.getmembers()
        if len(members) != len(ALLOWED) or {member.name for member in members} != {PREFIX + name for name in ALLOWED}:
            raise ValueError('unexpected package assets')
        if any(not member.isfile() or member.size > 131072 for member in members):
            raise ValueError('non-regular or oversized package asset')
        extraction.mkdir(mode=0o700)
        for member in members:
            asset = package.extractfile(member)
            assert asset is not None
            content = asset.read(131073)
            if len(content) != member.size:
                raise ValueError('invalid package size')
            (extraction / member.name[len(PREFIX):]).write_bytes(content)
    build = json.loads((extraction / 'BUILD.json').read_text())
    if build.get('kind') != 'local-trial-only':
        raise ValueError('wrong trial package kind')
    result = subprocess.run([sys.executable, str(extraction / 'install.py'), '--prefix', prefix], capture_output=True)
    if result.returncode:
        raise ValueError('file installation failed')
    if not Path(prefix, 'enhanced_route_helper.py').is_file():
        raise ValueError('installed helper missing')
    print('archive-validated-and-file-installed; no service enabled')

if __name__ == '__main__':
    main(*sys.argv[1:])
