"""Download immutable official native theme ZIPs for the theme-only lab.

No source build, Full installer, Plugin/Helper installation or production access.
"""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/native-theme-assets'
PINS = {
    'v1.2.0': 'bc2aeb1810b19800e4dcd9f40ae480021efe3ade16d5b9f752c5568a20e9602e',
    'v1.2.1': '54ef15efe37707109ce721ed22608745a575b3683038951b02b05d1724d3ff17',
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for version, pin in PINS.items():
        request = urllib.request.Request(
            'https://api.github.com/repos/casiuna/Glassmorphism-Enhanced/releases/tags/' + version,
            headers={'User-Agent': 'Enhanced-native-theme-only-acceptance', 'Accept': 'application/vnd.github+json'},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            release = json.load(response)
        assets = [a for a in release['assets'] if a['name'].endswith('.zip')]
        assert release['tag_name'] == version and not release['draft'] and len(assets) == 1
        asset = assets[0]
        assert Path(asset['name']).name == asset['name']
        assert asset['browser_download_url'].startswith(
            'https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/' + version + '/')
        with urllib.request.urlopen(asset['browser_download_url'], timeout=120) as response:
            data = response.read(67108865)
        digest = hashlib.sha256(data).hexdigest()
        assert digest == pin and asset['digest'] == 'sha256:' + digest
        assert len(data) == asset['size'] and len(data) <= 67108864
        path = OUT / asset['name']
        assert not path.is_symlink()
        path.write_bytes(data)
        records.append({'version': version, 'id': asset['id'], 'name': asset['name'],
                        'url': asset['browser_download_url'], 'sha256': digest,
                        'bytes': len(data), 'path': str(path)})
    report = OUT / 'download-verification.json'
    report.write_text(json.dumps(records, indent=2) + '\n')
    print(json.dumps({'report': str(report), 'assets': records}, indent=2))


if __name__ == '__main__':
    main()
