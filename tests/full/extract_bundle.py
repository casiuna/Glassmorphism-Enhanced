"""Extract and verify the stable Full transport for isolated tests, never install it."""
import io
import os
import sys
import tarfile
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'distribution'))
from enhanced_full.bundle import Bundle, safe_name
from enhanced_full.safety import Refused


def extract(archive_path, destination):
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise Refused('test-extraction-destination-must-be-new')
    with tarfile.open(archive_path, 'r:gz') as outer:
        members = outer.getmembers()
        if len(members) != 1 or not members[0].isfile() or not members[0].name.endswith('.zip') or members[0].size > 134217728:
            raise Refused('Full-transport-must-contain-one-bounded-ZIP')
        safe_name(members[0].name)
        stream = outer.extractfile(members[0])
        if stream is None:
            raise Refused('missing-inner-Full-ZIP')
        inner = stream.read()
    with zipfile.ZipFile(io.BytesIO(inner)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len(names) > 200:
            raise Refused('duplicate-or-excessive-Full-ZIP-entries')
        total = 0
        for entry in archive.infolist():
            safe_name(entry.filename)
            total += entry.file_size
            if entry.is_dir() or entry.file_size > 134217728 or total > 268435456 or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise Refused('unsafe-Full-ZIP-entry')
        if archive.testzip() is not None:
            raise Refused('Full-ZIP-CRC')
        destination.mkdir(mode=0o700, parents=True)
        for entry in archive.infolist():
            path = destination / entry.filename
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with path.open('xb') as output:
                output.write(archive.read(entry))
            path.chmod(0o644)
    Bundle(destination, allow_development=True)
    return destination


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: extract_bundle.py Full.tar.gz new-directory')
    extract(sys.argv[1], sys.argv[2])
    print('Full transport extracted and checksums verified; no installation performed')
