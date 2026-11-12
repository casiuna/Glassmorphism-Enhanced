"""Verify a Full distribution before opening any administrator write path."""
import hashlib
import io
import json
import re
import tarfile
import zipfile
from pathlib import Path, PurePosixPath
from .safety import Refused

PLUGIN_FILES = {'komari-plugin.json', 'script.js', 'protocol.cjs', 'storage.cjs', 'request-limits.cjs', 'LICENSE', 'BUILD.json'}
HELPER_FILES = {'enhanced_route_helper.py', 'install.py', 'helper-version.json', 'enhanced-route-helper.service', 'enhanced-route-helper.openrc', 'helper.example.json', 'README.md', 'LICENSE', 'BUILD.json'}
PERMISSIONS = {'node': True, 'allowRoutes': True, 'maxHTTPBodyBytes': 16384, 'timeout': 10}
THEME_SHORT = 'Enhanced'
RELEASE_CHANNEL = 'stable'
RELEASE_VERSION = '1.2.0'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    p = PurePosixPath(name)
    if not name or p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name or any(ord(c) < 32 for c in name) or p.as_posix() != name.rstrip('/'):
        raise Refused('unsafe-package-path')
    return p


def native_zip(data, kind, allow_legacy=False):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len(names) > 10000:
            raise Refused('duplicate-or-excessive-archive-entries')
        total = 0
        for item in archive.infolist():
            safe_name(item.filename)
            total += item.file_size
            if (item.external_attr >> 16) & 0o170000 == 0o120000 or item.file_size > 134217728 or total > 268435456:
                raise Refused('unsafe-or-oversized-native-archive')
        if archive.testzip() is not None:
            raise Refused('native-archive-crc')
        manifest = json.loads(archive.read('komari-theme.json' if kind == 'theme' else 'komari-plugin.json'))
        if kind == 'theme':
            if {n.split('/')[0] for n in names} != {'komari-theme.json', 'preview.png', 'dist'} or 'dist/index.html' not in names:
                raise Refused('invalid-native-theme-layout')
            if manifest.get('short') != THEME_SHORT:
                raise Refused('not-an-enhanced-theme')
        elif set(names) != PLUGIN_FILES or manifest.get('short') != 'enhanced-route-probe' or manifest.get('permissions') != PERMISSIONS or not (manifest.get('channel') == RELEASE_CHANNEL or (allow_legacy and manifest.get('version') == '0.1.0' and 'channel' not in manifest)):
            raise Refused('unexpected-plugin-files-or-privileges')
        return manifest


def helper_members(data):
    result = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for item in archive.getmembers():
            path = safe_name(item.name)
            if not item.isfile() or len(path.parts) != 2 or item.size > 1048576 or path.parts[1] not in HELPER_FILES or path.parts[1] in result:
                raise Refused('unsafe-helper-archive')
            result[path.parts[1]] = archive.extractfile(item).read()
    if set(result) != HELPER_FILES or json.loads(result['helper.example.json']).get('enabled') is not False:
        raise Refused('incomplete-or-enabled-helper-package')
    return result

class Bundle:
    def __init__(self, directory, allow_development=False):
        self.directory = Path(directory).absolute()
        self.manifest = json.loads(self.read('full-manifest.json'))
        m = self.manifest
        if m.get('schema') != 1 or m.get('product') != 'Glassmorphism Enhanced' or m.get('channel') != RELEASE_CHANNEL or m.get('supportedKomari') != ['1.6.0'] or not re.fullmatch('[0-9a-f]{40}', m.get('commit', '')) or m.get('realTracerouteValidated') is not False:
            raise Refused('unsupported-full-manifest')
        if m.get('dirty') is not False and not (allow_development and m.get('dirty') is True):
            raise Refused('dirty-development-bundle-not-a-deliverable')
        files = m['files']
        if not isinstance(files, dict) or len(files) > 200:
            raise Refused('invalid-file-matrix')
        for name, record in files.items():
            data = self.read(name)
            if record != {'sha256': digest(data), 'bytes': len(data)}:
                raise Refused('full-bundle-file-checksum-mismatch')
        actual = {p.relative_to(self.directory).as_posix() for p in self.directory.rglob('*') if p.is_file() or p.is_symlink()}
        if actual != set(files) | {'full-manifest.json', 'SHA256SUMS'}:
            raise Refused('unexpected-files-in-full-bundle; keep-private-state-outside')
        sums = dict((name, digest(self.read(name))) for name in [*files, 'full-manifest.json'])
        expected = ''.join(sums[name] + '  ' + name + '\n' for name in sorted(sums))
        if self.read('SHA256SUMS').decode() != expected:
            raise Refused('full-checksum-list-mismatch')
        for kind in ('theme', 'plugin'):
            info = native_zip(self.artifact(kind), kind)
            if info['version'] != m['modules'][kind]['version'] or info['short'] != m['modules'][kind]['short']:
                raise Refused('module-version-matrix-mismatch')
        if m['modules']['theme']['short'] != THEME_SHORT or m['modules']['theme']['version'] != RELEASE_VERSION or m['version'] != RELEASE_VERSION:
            raise Refused('stable-theme-identity-mismatch')
        with zipfile.ZipFile(io.BytesIO(self.artifact('theme'))) as archive:
            build = json.loads(archive.read('dist/BUILD.json'))
            if build.get('commit') != m['commit'] or build.get('dirty') is not m['dirty'] or build.get('version') != m['version']:
                raise Refused('theme-build-metadata-mismatch')
        members = helper_members(self.artifact('helper'))
        helper_info = json.loads(members['helper-version.json'])
        if helper_info['version'] != m['modules']['helper']['version'] or helper_info.get('channel') != RELEASE_CHANNEL or helper_info.get('product') != m['product']:
            raise Refused('stable-helper-version-matrix-mismatch')
        for kind in ('plugin', 'helper'):
            if kind == 'plugin':
                with zipfile.ZipFile(io.BytesIO(self.artifact(kind))) as z:
                    build = json.loads(z.read('BUILD.json'))
            else:
                build = json.loads(members['BUILD.json'])
            if build['commit'] != m['commit'] or build['dirty'] is not m['dirty']:
                raise Refused('module-build-metadata-mismatch')

    def read(self, name):
        safe_name(name)
        path = self.directory.joinpath(*PurePosixPath(name).parts)
        for candidate in [path, *path.parents]:
            if candidate.is_symlink():
                raise Refused('symlink-in-full-bundle')
            if candidate == self.directory:
                break
        if not path.is_file() or path.stat().st_size > 134217728:
            raise Refused('missing-or-oversized-full-asset')
        return path.read_bytes()

    def artifact(self, kind):
        return self.read(self.manifest['modules'][kind]['path'])
