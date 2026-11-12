"""Explicit test-only archive fixtures, never released artifacts or fake API data."""
import argparse
import io
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'distribution'))
from enhanced_full.bundle import Bundle, digest


def rewritten_zip(data, manifest_name, changes, broken_script=False):
    result = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as source, zipfile.ZipFile(result, 'w', zipfile.ZIP_DEFLATED) as output:
        for info in source.infolist():
            content = source.read(info.filename)
            if info.filename == manifest_name:
                manifest = json.loads(content)
                manifest.update(changes)
                manifest['description'] = 'LOCAL TEST FIXTURE ONLY; NOT a released historical binary'
                content = (json.dumps(manifest, indent=2) + '\n').encode()
            if info.filename == 'BUILD.json':
                build = json.loads(content)
                build['version'] = changes['version']
                content = json.dumps(build).encode()
            if broken_script and info.filename == 'script.js':
                content = b"throw new Error('deliberate isolated native reload failure fixture')\n"
            output.writestr(info, content)
    return result.getvalue()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundle', required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args()
    bundle = Bundle(args.bundle, True)
    output = Path(args.output)
    output.mkdir(exist_ok=True, mode=0o700)
    theme = bundle.artifact('theme')
    (output / 'formal-identity-fixture.zip').write_bytes(rewritten_zip(theme, 'komari-theme.json', {'short': 'Enhanced', 'name': 'Enhanced FORMAL IDENTITY TEST FIXTURE', 'version': '1.1.1'}))
    # Build ACTUAL historical plugin source, not today's code with a fake
    # version. This is a test artifact, never an official released binary.
    legacy_commit = '37092754388f04d44a3131a4f51130b8b6a1abae'
    with zipfile.ZipFile(output / 'legacy-plugin-source-fixture.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ('komari-plugin.json', 'script.js', 'protocol.cjs', 'storage.cjs', 'request-limits.cjs', 'LICENSE'):
            archive.writestr(name, subprocess.check_output(['git', 'show', f'{legacy_commit}:companion/enhanced-route-probe/{name}'], cwd=ROOT))
        archive.writestr('BUILD.json', json.dumps({'commit': legacy_commit, 'dirty': False, 'kind': 'historical-source-test-fixture', 'version': '0.1.0', 'note': 'Built from historical source for isolated upgrade tests; NOT an official binary'}))
    fault = output / 'reload-fault-full'
    shutil.copytree(args.bundle, fault)
    manifest = bundle.manifest
    version = '0.2.0+git.reload-fault-fixture'
    path = manifest['modules']['plugin']['path']
    content = rewritten_zip(bundle.artifact('plugin'), 'komari-plugin.json', {'version': version}, broken_script=True)
    (fault / path).write_bytes(content)
    manifest['modules']['plugin'].update(version=version, sha256=digest(content), bytes=len(content))
    manifest['files'][path] = {'sha256': digest(content), 'bytes': len(content)}
    (fault / 'full-manifest.json').write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
    names = [*manifest['files'], 'full-manifest.json']
    (fault / 'SHA256SUMS').write_text(''.join(digest((fault / n).read_bytes()) + '  ' + n + '\n' for n in sorted(names)))
    Bundle(fault, True)
    print('test-only archives prepared; never publish these fixtures')

if __name__ == '__main__':
    main()
