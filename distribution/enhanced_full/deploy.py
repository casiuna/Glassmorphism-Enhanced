"""Scoped deployment journals and compensating rollback, not a database restore.

Komari 1.6 has no transaction/CAS API. Operate during a quiet administrator
window; refuse detected conflicts rather than overwriting another operator.
"""
import json
import re
from pathlib import Path
from .api import ROOT, SHORT, THEME
from .bundle import digest, native_zip
from .safety import Refused, private_bytes, private_directory, save_private


def snapshot(api):
    public = api.rpc('public:getPublicSettings')
    themes = api.rest('/api/admin/theme/list') or []
    plugins = api.rpc('admin:listPlugins') or []
    theme = next((v for v in themes if v.get('short') == THEME), None)
    plugin = next((v for v in plugins if v.get('short') == SHORT), None)
    return {
        'active': public['theme'],
        'theme': {'version': theme['version']} if theme else None,
        'plugin': {'version': plugin['version'], 'enabled': bool(plugin['enabled'])} if plugin else None,
        'config': api.plugin_config() if plugin else None,
        'activeThemeSettings': public['theme_settings'] if public['theme'] == THEME else None,
    }


def upgraded_theme_settings(bundle, previous):
    """Komari adds candidate manifest defaults; existing values still win."""
    manifest = native_zip(bundle.artifact('theme'), 'theme')
    defaults = {field['key']: field['default'] for field in manifest['configuration']['data'] if field.get('key') and 'default' in field}
    return {**defaults, **previous}


def version_key(value):
    match = re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-trial\.(0|[1-9]\d*))?(?:\+[0-9A-Za-z.-]+)?', value) if isinstance(value, str) and len(value) <= 160 else None
    if not match:
        return None
    return (*map(int, match.group(1, 2, 3)), match.group(4) is None, int(match.group(4) or '0'))

def module_action(installed, candidate, operation):
    if operation == 'uninstall':
        return 'remove' if installed else 'absent'
    if not installed:
        return 'install'
    if installed['version'] == candidate:
        return 'keep'
    old, new = version_key(installed['version']), version_key(candidate)
    if old is None or new is None:
        return 'unverified-version-blocked'
    if old > new:
        return 'downgrade-blocked; use-explicit-rollback'
    return 'replace-build; ordering-not-inferred' if old == new else 'upgrade'

def plan(bundle, before, operation):
    modules = bundle.manifest['modules']
    actions = []
    for kind in ('theme', 'plugin'):
        installed = before[kind]
        action = module_action(installed, modules[kind]['version'], operation)
        actions.append({'module': kind, 'action': action, 'installed': installed['version'] if installed else None, 'candidate': modules[kind]['version']})
    return {'mode': 'dry-run', 'operation': operation, 'candidateCommit': bundle.manifest['commit'], 'actions': actions,
            'permissions': {'nodeCompatibility': True, 'allowRoutes': True, 'systemRPC': False, 'exec': False},
            'automaticProbeDefault': False, 'nodeInstallation': 'explicit-on-each-node',
            'constraints': ['quiet administrator window; no server CAS', 'retain formal Enhanced theme and all existing settings', 'uninstall requires stopped helpers and a private checkpoint', 'legacy 0.1 storage stays in place on upgrade; keep a host backup for disaster recovery']}


def previous_assets(bundle, before, operation, previous):
    result = {}
    for kind in ('theme', 'plugin'):
        old = before[kind]
        if not old:
            continue
        target_version = bundle.manifest['modules'][kind]['version']
        if old['version'] == target_version:
            data = bundle.artifact(kind)
        elif kind in previous:
            data = Path(previous[kind]).read_bytes()
        else:
            raise Refused('previous-' + kind + '-archive-required-before-any-write')
        info = native_zip(data, kind, allow_legacy=True)
        if info.get('short') != (THEME if kind == 'theme' else SHORT) or info['version'] != old['version']:
            raise Refused('previous-archive-does-not-match-installed-version')
        result[kind] = data
    return result


def checkpoint(api):
    value = api.json(ROOT + '/checkpoint')
    if value.get('schema') != 1 or not isinstance(value.get('nodes'), dict) or len(value['nodes']) > 200:
        raise Refused('invalid-private-plugin-checkpoint')
    for uuid, node in value['nodes'].items():
        if len(json.dumps({'uuid': uuid, 'node': node}).encode()) > 16384:
            raise Refused('checkpoint-node-exceeds-native-restore-limit')
    return value

def verify_plugin_health(api, expected_version):
    health = api.json(ROOT + '/health')
    if health.get('schema') != 1 or health.get('version') != expected_version or health.get('storage') != 'healthy':
        raise Refused('installed-plugin-health-or-version-readback-mismatch')


def load_journal(directory, api):
    directory = private_directory(directory)
    journal = json.loads(private_bytes(directory / 'journal.json'))
    if journal.get('schema') != 1 or journal.get('panel') != api.panel or journal.get('themeShort') != THEME or journal.get('pluginShort') != SHORT or journal.get('operation') not in ('install', 'uninstall'):
        raise Refused('journal-owner-origin-or-schema-mismatch')
    for name, record in journal['files'].items():
        if name not in ('previous-theme.zip', 'previous-plugin.zip', 'checkpoint.json') or digest(private_bytes(directory / name, 134217728)) != record:
            raise Refused('backup-checksum-mismatch')
    return directory, journal


def restore(api, bundle, directory, journal):
    before = journal['before']
    current = snapshot(api)
    if current == before and journal['status'] == 'rolled-back':
        return 'already-rolled-back'
    # Never blindly compensate across an unrelated version/configuration change.
    for kind in ('theme', 'plugin'):
        allowed = {None, bundle.manifest['modules'][kind]['version'], before[kind]['version'] if before[kind] else None}
        if current[kind] and current[kind]['version'] not in allowed:
            raise Refused('rollback-conflict; preserve-private-backup-for-review')
    allowed_configs = [before['config'], {'enabled': False, 'nodes': '{}'}]
    if before['config'] is not None:
        allowed_configs.append({**before['config'], 'enabled': False})
    if current['plugin'] and current['config'] not in allowed_configs:
        raise Refused('rollback-configuration-conflict; no-overwrite')
    if current['active'] not in {before['active'], THEME, journal.get('fallback', 'default')}:
        raise Refused('rollback-active-theme-conflict; no-overwrite')
    if current['activeThemeSettings'] is not None and before['activeThemeSettings'] is not None and current['activeThemeSettings'] not in (before['activeThemeSettings'], upgraded_theme_settings(bundle, before['activeThemeSettings'])):
        raise Refused('rollback-theme-settings-conflict; no-overwrite')
    if current['plugin']:
        api.enabled(False)
    if before['theme']:
        api.upload('theme', private_bytes(directory / 'previous-theme.zip', 134217728))
        if before['activeThemeSettings'] is not None:
            # The native uploader persists new defaults. Restore the old map
            # only after the optimistic conflict check, never across admin edits.
            api.rest('/api/admin/theme/settings?theme=' + THEME, before['activeThemeSettings'])
    # A destructive uninstall is restored through THIS bundle's fixed-purpose
    # checkpoint capability before an older, compatible plugin is reinstalled.
    if before['plugin']:
        if journal['operation'] == 'uninstall' and 'checkpoint.json' in journal['files']:
            api.upload('plugin', bundle.artifact('plugin'))
            api.set_config({**before['config'], 'enabled': False})
            api.enabled(True, approved=True)
            saved = json.loads(private_bytes(directory / 'checkpoint.json'))
            existing = checkpoint(api)
            if existing['nodes'] and existing != saved:
                raise Refused('restore-refuses-nonempty-unrelated-plugin-state')
            for uuid, node in saved['nodes'].items():
                api.json(ROOT + '/restore-node', {'uuid': uuid, 'node': node})
            if checkpoint(api) != saved:
                raise Refused('private-state-restore-readback-mismatch')
            api.enabled(False)
        api.upload('plugin', private_bytes(directory / 'previous-plugin.zip', 134217728))
        api.set_config(before['config'])
        api.enabled(before['plugin']['enabled'], approved=True)
    elif current['plugin']:
        api.rpc('admin:deletePlugin', {'short': SHORT})
    api.activate(before['active'])
    if not before['theme'] and snapshot(api)['theme']:
        api.rest('/api/admin/theme/delete', {'short': THEME})
    if snapshot(api) != before:
        raise Refused('rollback-readback-mismatch; preserve-backup')
    journal['status'] = 'rolled-back'
    save_private(directory / 'journal.json', journal)
    return 'rolled-back-and-readback-verified'


def deploy(api, bundle, operation='install', apply=False, approve=False, backup_dir=None, previous=None, activate=False, helpers_stopped=False):
    version = api.rpc('public:getVersion')['version']
    if version not in bundle.manifest['supportedKomari']:
        raise Refused('unsupported-komari-version; validated-only-on-1.6.0')
    before = snapshot(api)
    description = plan(bundle, before, operation)
    description['activateTheme'] = bool(activate and operation == 'install')
    if not apply:
        return description
    if not approve:
        raise Refused('apply-needs-explicit-approve-route-plugin')
    if not backup_dir:
        raise Refused('explicit-private-backup-directory-required')
    if any('blocked' in action['action'] for action in description['actions']):
        raise Refused('unverified-version-or-downgrade-blocked; use-reviewed-explicit-rollback')
    if operation == 'uninstall' and not helpers_stopped:
        raise Refused('stop-helpers-and-explicitly-acknowledge-before-uninstall')
    if operation == 'install' and all(a['action'] == 'keep' for a in description['actions']) and (not activate or before['active'] == THEME):
        if before['plugin']['enabled']:
            verify_plugin_health(api, bundle.manifest['modules']['plugin']['version'])
        return {**description, 'mode': 'apply', 'status': 'already-installed; no-writes'}
    old_assets = previous_assets(bundle, before, operation, previous or {})
    directory = private_directory(backup_dir, create=True)
    journal = {'schema': 1, 'themeShort': THEME, 'pluginShort': SHORT, 'panel': api.panel, 'operation': operation,
               'commit': bundle.manifest['commit'], 'before': before, 'files': {}, 'status': 'prepared'}
    for kind, content in old_assets.items():
        name = 'previous-' + kind + '.zip'
        save_private(directory / name, content)
        journal['files'][name] = digest(content)
    save_private(directory / 'journal.json', journal)
    if snapshot(api) != before:
        raise Refused('preflight-state-changed; no-application-write')
    try:
        if operation == 'install':
            for action in description['actions']:
                if action['action'] != 'keep':
                    api.upload(action['module'], bundle.artifact(action['module']))
                    installed = snapshot(api)[action['module']]
                    if not installed or installed['version'] != bundle.manifest['modules'][action['module']]['version']:
                        raise Refused('installed-module-readback-mismatch')
            if before['plugin']:
                if api.plugin_config() != before['config']:
                    raise Refused('upgrade-changed-existing-plugin-configuration')
                api.enabled(before['plugin']['enabled'], approved=True)
            else:
                api.enabled(True, approved=True)
                if api.plugin_config().get('enabled') is not False:
                    raise Refused('new-install-must-not-enable-automatic-probing')
            if activate:
                api.activate(THEME)
            if not before['plugin'] or before['plugin']['enabled']:
                verify_plugin_health(api, bundle.manifest['modules']['plugin']['version'])
        else:
            if before['plugin']:
                # Save the complete private state BEFORE the native delete
                # removes storage; no global backup/restore or database access.
                api.set_config({**before['config'], 'enabled': False})
                api.enabled(True, approved=True)
                saved = checkpoint(api)
                save_private(directory / 'checkpoint.json', saved)
                journal['files']['checkpoint.json'] = digest((directory / 'checkpoint.json').read_bytes())
                save_private(directory / 'journal.json', journal)
                api.enabled(False)
                api.rpc('admin:deletePlugin', {'short': SHORT})
            themes = api.rest('/api/admin/theme/list') or []
            alternatives = [t.get('short') for t in themes if t.get('short') and t.get('short') != THEME]
            fallback = before['active'] if before['active'] != THEME else (alternatives[0] if alternatives else 'default')
            journal['fallback'] = fallback
            save_private(directory / 'journal.json', journal)
            api.activate(fallback)
            if before['theme']:
                api.rest('/api/admin/theme/delete', {'short': THEME})
        after = snapshot(api)
        if operation == 'uninstall' and (after['theme'] or after['plugin']):
            raise Refused('uninstall-readback-mismatch')
        if operation == 'install' and before['activeThemeSettings'] is not None and after['active'] == THEME and after['activeThemeSettings'] != upgraded_theme_settings(bundle, before['activeThemeSettings']):
            raise Refused('upgrade-changed-existing-theme-settings')
        journal['status'], journal['after'] = 'completed', after
        save_private(directory / 'journal.json', journal)
        return {**description, 'mode': 'apply', 'status': 'completed-and-readback-verified', 'backup': str(directory)}
    except Exception:
        try:
            status = restore(api, bundle, directory, journal)
        except Exception:
            raise Refused('operation-failed; rollback-incomplete; preserve-private-backup') from None
        raise Refused('operation-failed; ' + status) from None
