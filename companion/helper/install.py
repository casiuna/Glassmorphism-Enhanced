#!/usr/bin/env python3
"""Explicit-prefix, file-only installer. Never creates users, enables services,
changes networking, installs packages or reads/copies a credential file.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

FILES = ['enhanced_route_helper.py', 'enhanced-route-helper.service', 'enhanced-route-helper.openrc', 'helper.example.json', 'LICENSE', 'README.md']
MARKER = '.enhanced-route-install.json'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def install(source, prefix):
    if prefix.exists() or prefix.is_symlink():
        raise ValueError('refusing an existing prefix; use a new version directory')
    # Validate every asset before creating a destination (not a partial install).
    for name in FILES:
        if not (source / name).is_file() or (source / name).is_symlink():
            raise ValueError('package asset missing or unsafe')
    prefix.mkdir(parents=True)
    try:
        for name in FILES:
            shutil.copyfile(source / name, prefix / name)
            (prefix / name).chmod(0o755 if name.endswith('.openrc') else 0o644)
        hashes = {name: digest(prefix / name) for name in FILES}
        (prefix / MARKER).write_text(json.dumps({'version': 1, 'files': hashes}, indent=2) + '\n')
    except Exception:
        # Never delete unrelated files or config. Only remove our newly created,
        # explicitly enumerated assets on failure.
        for name in FILES + [MARKER]:
            (prefix / name).unlink(missing_ok=True)
        prefix.rmdir()
        raise

def uninstall(prefix):
    if prefix.is_symlink() or not (prefix / MARKER).is_file():
        raise ValueError('not an owned installation')
    data = json.loads((prefix / MARKER).read_text())
    if data.get('version') != 1 or set(data.get('files', {})) != set(FILES):
        raise ValueError('invalid installation manifest')
    for name, checksum in data['files'].items():
        path = prefix / name
        if path.is_symlink() or not path.is_file() or digest(path) != checksum:
            raise ValueError('modified installation; preserve it for manual review')
    for name in FILES + [MARKER]:
        (prefix / name).unlink()
    if not any(prefix.iterdir()):
        prefix.rmdir()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prefix', required=True)
    parser.add_argument('--uninstall', action='store_true')
    args = parser.parse_args()
    prefix = Path(args.prefix)
    if not prefix.is_absolute() or prefix == Path('/'):
        raise ValueError('explicit absolute versioned prefix required')
    if args.uninstall:
        uninstall(prefix)
    else:
        install(Path(__file__).resolve().parent, prefix)
    print('file-installation-removed; service/config untouched' if args.uninstall else 'files-installed; service/config not enabled')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError):
        raise SystemExit('installation refused; inspect package, prefix and permissions')
