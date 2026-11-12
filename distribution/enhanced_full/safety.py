"""File/transport boundaries shared by the administrator and node installers."""
import ipaddress
import json
import os
import re
import stat
import urllib.parse
from pathlib import Path

UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

class Refused(Exception):
    """Only fixed, credential-free categories belong in user-facing errors."""


def origin(value, allow_loopback=False):
    if not isinstance(value, str) or any(c.isspace() or ord(c) < 32 for c in value) or any(c in value for c in ('?', '#', '\\')):
        raise Refused('invalid-panel-origin')
    try:
        parsed = urllib.parse.urlsplit(value)
        port = parsed.port
    except ValueError:
        raise Refused('invalid-panel-origin') from None
    try:
        loopback = ipaddress.ip_address(parsed.hostname or '').is_loopback
    except ValueError:
        # Never resolve DNS into an insecure localhost exception.
        loopback = False
    if (parsed.scheme != 'https' and not (allow_loopback and loopback and parsed.scheme == 'http')) or not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment or parsed.path not in ('', '/') or any(c.isspace() or ord(c) < 32 for c in value) or '%' in parsed.netloc or '\\' in value or port == 0:
        raise Refused('https-origin-required; literal-loopback-HTTP-needs-explicit-opt-in')
    return value.rstrip('/')


def private_bytes(path, limit=4194304):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > limit:
            raise Refused('private-file-owner-mode-or-size')
        data = os.read(fd, limit + 1)
        if len(data) > limit:
            raise Refused('private-file-size')
        return data
    finally:
        os.close(fd)


def reject_symlink_path(path):
    path = Path(path).absolute()
    for parent in [path, *path.parents]:
        if parent.is_symlink():
            raise Refused('symlink-in-private-path')
    return path

def private_directory(path, create=False):
    path = reject_symlink_path(path)
    if create:
        path.mkdir(mode=0o700, parents=True, exist_ok=False)
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise Refused('private-directory-owner-or-mode')
    return path


def save_private(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    path = Path(path)
    # No truncation/following of an untrusted destination. Replace only a
    # verified private file inside an owner-only directory.
    if path.exists() or path.is_symlink():
        private_bytes(path, 134217728)
    temporary = path.with_name(path.name + '.pending')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
