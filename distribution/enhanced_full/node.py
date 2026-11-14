"""Explicit, node-local bootstrap. Reads only the file the operator selected.

There is no short-lived native enrollment identity in Komari 1.6.0: the helper
must retain a private copy of this node's native credential. Nothing is sent to
the browser, placed in argv/environment, or used to modify/run the Komari Agent.
"""
import json
import runpy
import subprocess
import sys
import tempfile
from pathlib import Path
from .api import API, ROOT
from .bundle import digest, helper_members
from .safety import UUID, Refused, origin, private_bytes, private_directory, reject_symlink_path, save_private


def installer(members, directory):
    for name, content in members.items():
        (directory / name).write_bytes(content)
    return runpy.run_path(str(directory / 'install.py'))


def enroll(bundle, panel, uuid, agent_config, prefix, state_dir, apply=False, allow_loopback=False, enable_local=False, run=False, once=False, fixture_dir=None):
    panel = origin(panel, allow_loopback)
    if not UUID.fullmatch(uuid) or not Path(prefix).is_absolute() or Path(prefix) == Path('/') or Path(prefix).is_symlink():
        raise Refused('explicit-node-uuid-and-absolute-version-prefix-required')
    source = json.loads(private_bytes(agent_config, 16384))
    if origin(source.get('endpoint', ''), allow_loopback) != panel:
        raise Refused('node-agent-origin-mismatch; no-credential-sent')
    token = source.get('token')
    if not isinstance(token, str) or not 16 <= len(token) <= 4096 or any(c.isspace() or ord(c) < 33 or ord(c) > 126 for c in token):
        raise Refused('invalid-native-node-credential')
    members = helper_members(bundle.artifact('helper'))
    state = reject_symlink_path(state_dir)
    destination = reject_symlink_path(prefix)
    if destination.exists():
        marker_path = destination / '.enhanced-route-install.json'
        if marker_path.is_symlink() or not marker_path.is_file() or marker_path.stat().st_size > 65536:
            raise Refused('existing-code-prefix-is-not-owned')
        marker = json.loads(marker_path.read_text())
        installed_names = set(members) - {'install.py', 'BUILD.json'}
        if marker.get('version') != 1 or set(marker.get('files', {})) != installed_names:
            raise Refused('existing-code-prefix-is-not-owned')
        for name in installed_names:
            path = destination / name
            if path.is_symlink() or not path.is_file() or digest(path.read_bytes()) != marker['files'][name] or path.read_bytes() != members[name]:
                raise Refused('existing-code-prefix-modified-or-different-version; choose-new-prefix')
    config = {'panel': panel, 'uuid': uuid, 'tokenFile': str(state / 'agent-token'), 'enabled': enable_local, 'allowLoopback': allow_loopback}
    if state.exists() or state.is_symlink():
        private_directory(state)
        old = json.loads(private_bytes(state / 'helper.json', 16384))
        # Protocol selection / external-query consent remain local to this UUID.
        for key in ('probeProtocols', 'addressFamily', 'cymruEnabled', 'cymruConsent', 'prefixHints'):
            if key in old:
                config[key] = old[key]
        if {k: v for k, v in old.items() if k != 'enabled'} != {k: v for k, v in config.items() if k != 'enabled'} or private_bytes(state / 'agent-token', 4096).decode() != token:
            raise Refused('existing-node-registration-conflict; preserve-private-state')
        config['enabled'] = old['enabled'] or enable_local
    if run and not config['enabled']:
        raise Refused('explicit-enable-local-required-before-run')
    description = {'mode': 'apply' if apply else 'dry-run', 'uuid': uuid, 'helperVersion': bundle.manifest['modules']['helper']['version'],
                   'prefix': str(destination), 'state': str(state), 'registeredBy': 'native-agent-body-principal',
                   'credentialHandling': 'read selected private file locally; retain owner-only node credential; never browser/argv/log',
                   'agentProcessChanged': False, 'serviceInstalled': False, 'localPollingEnabled': config['enabled'], 'runForeground': run}
    if not apply:
        return description
    if hasattr(__import__('os'), 'geteuid') and __import__('os').geteuid() == 0:
        raise Refused('run-as-dedicated-unprivileged-user-with-authorized-private-agent-file; no-root-helper')
    # The identity check is register-only: never leases or executes a probe.
    api = API(panel, allow_loopback=allow_loopback, agent=True)
    registered = api.json(ROOT + '/register', {'token': token, 'helper_version': bundle.manifest['modules']['helper']['version']})
    if registered.get('registered') is not True or registered.get('uuid') != uuid:
        raise Refused('authenticated-node-uuid-mismatch; no-local-install')
    if not state.exists():
        private_directory(state, create=True)
    with tempfile.TemporaryDirectory(prefix='owned-bootstrap-', dir=state) as temporary:
        owned = installer(members, Path(temporary))
        if destination.exists():
            marker = json.loads((destination / owned['MARKER']).read_text())
            if marker.get('version') != 1 or set(marker.get('files', {})) != set(owned['FILES']):
                raise Refused('existing-code-prefix-is-not-owned')
            for name in owned['FILES']:
                path = destination / name
                if path.is_symlink() or not path.is_file() or digest(path.read_bytes()) != marker['files'][name] or path.read_bytes() != members[name]:
                    raise Refused('existing-code-prefix-modified-or-different-version; choose-new-prefix')
        else:
            owned['install'](Path(temporary), destination)
    if (state / 'registration.json').exists():
        save_private(state / 'registration.previous.json', private_bytes(state / 'registration.json'))
    save_private(state / 'agent-token', token.encode())
    save_private(state / 'helper.json', config)
    save_private(state / 'registration.json', {'schema': 1, 'uuid': uuid, 'prefix': str(destination), 'commit': bundle.manifest['commit'], 'version': bundle.manifest['modules']['helper']['version']})
    if json.loads(private_bytes(state / 'helper.json', 16384)) != config or private_bytes(state / 'agent-token', 4096).decode() != token:
        raise Refused('node-file-readback-mismatch')
    if run:
        argv = [sys.executable, str(destination / 'enhanced_route_helper.py'), '--config', str(state / 'helper.json')]
        if once:
            argv.append('--once')
        if fixture_dir:
            argv.extend(['--fixture-dir', fixture_dir])
        subprocess.run(argv, check=True)
    return {**description, 'status': 'registered-and-installed; service-not-enabled'}


def uninstall_node(bundle, prefix, state_dir, apply=False, helper_stopped=False):
    reject_symlink_path(prefix)
    state = private_directory(state_dir)
    registration = json.loads(private_bytes(state / 'registration.json', 16384))
    if registration.get('schema') != 1 or registration.get('prefix') != str(Path(prefix)) or Path(prefix).is_symlink():
        raise Refused('node-installation-receipt-mismatch')
    if not apply:
        return {'mode': 'dry-run', 'operation': 'uninstall-node', 'preserve': ['private-config', 'node-token', 'all-unowned-files'], 'stopServiceManually': True}
    if not helper_stopped:
        raise Refused('explicit-helper-stopped-acknowledgment-required')
    with tempfile.TemporaryDirectory(prefix='owned-uninstall-', dir=state) as temporary:
        owned = installer(helper_members(bundle.artifact('helper')), Path(temporary))
        owned['uninstall'](Path(prefix))
    if Path(prefix).exists() and any((Path(prefix) / name).exists() for name in owned['FILES']):
        raise Refused('node-uninstall-readback-mismatch')
    return {'mode': 'apply', 'status': 'owned-code-removed; private-config-token-and-services-untouched'}
