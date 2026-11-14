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

RELOAD_FAULT_MARKER = 'enhanced-reload-fault-triggered.json'
RELOAD_FAULT_MESSAGE = 'ENHANCED_FULL_RELOAD_FAULT_TRIGGERED'


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
                if broken_script:
                    build.update(kind='isolated-reload-fault-fixture', fixtureOnly=True)
                content = json.dumps(build).encode()
            if broken_script and info.filename == 'script.js':
                # Executed by the ACTUAL native sandbox. Evidence is written
                # only into this isolated plugin's private storage before throw.
                marker = json.dumps({'schema': 1, 'phase': 'native-plugin-script-load', 'version': changes['version'], 'message': RELOAD_FAULT_MESSAGE})
                content = ("'use strict'\nconst fs = require('fs')\nconst path = require('path')\n"
                           f"fs.writeFileSync(path.join(__storageDir__, '{RELOAD_FAULT_MARKER}'), {json.dumps(marker)}, {{ encoding: 'utf8', mode: 0o600 }})\n"
                           f"throw new Error('{RELOAD_FAULT_MESSAGE}')\n").encode()
            output.writestr(info, content)
    return result.getvalue()


def reload_fault_bundle(bundle, output):
    fault = Path(output)
    shutil.copytree(bundle.directory, fault)
    manifest = json.loads(json.dumps(bundle.manifest))
    # Build metadata does not lower SemVer precedence. Keep the real candidate
    # base instead of hard-coding a previous minor version or weakening guards.
    version = manifest['modules']['plugin']['version'].split('+', 1)[0] + '+git.reload-fault-fixture'
    path = manifest['modules']['plugin']['path']
    content = rewritten_zip(bundle.artifact('plugin'), 'komari-plugin.json', {'version': version}, broken_script=True)
    (fault / path).write_bytes(content)
    manifest['modules']['plugin'].update(version=version, sha256=digest(content), bytes=len(content))
    manifest['files'][path] = {'sha256': digest(content), 'bytes': len(content)}
    (fault / 'full-manifest.json').write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
    names = [*manifest['files'], 'full-manifest.json']
    (fault / 'SHA256SUMS').write_text(''.join(digest((fault / n).read_bytes()) + '  ' + n + '\n' for n in sorted(names)))
    return Bundle(fault, True)


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
    # Retain the 0.1 source upgrade fixture above. For the later stable-release
    # rollback/upgrade round trip use v1.2.0's actual 0.2 source, not an invalid
    # downgrade of 0.3 registration policies into pre-registration 0.1 code.
    stable_commit = subprocess.check_output(['git', 'rev-parse', 'refs/tags/v1.2.0^{}'], cwd=ROOT, text=True).strip()
    with zipfile.ZipFile(output / 'v120-plugin-source-fixture.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ('komari-plugin.json', 'script.js', 'protocol.cjs', 'storage.cjs', 'request-limits.cjs', 'LICENSE'):
            archive.writestr(name, subprocess.check_output(['git', 'show', f'{stable_commit}:companion/enhanced-route-probe/{name}'], cwd=ROOT))
        archive.writestr('BUILD.json', json.dumps({'commit': stable_commit, 'dirty': False, 'kind': 'historical-source-test-fixture', 'version': '0.2.0', 'note': 'Actual v1.2.0 tagged plugin source; NOT an official binary'}))
    reload_fault_bundle(bundle, output / 'reload-fault-full')
    print('test-only archives prepared; never publish these fixtures')

if __name__ == '__main__':
    main()
