"""One product entry point; a dry-run never changes application configuration."""
import argparse
import ipaddress
import json
import sys
import urllib.parse
import zipfile
from pathlib import Path
from .api import API
from .bundle import Bundle
from .deploy import deploy, load_journal, restore
from .node import enroll, uninstall_node
from .safety import Refused


class PrivateArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        self.exit(2, 'REFUSED: unsupported-or-missing-option; never pass credentials in arguments\n')

def parser():
    p = PrivateArgumentParser(description=__doc__, allow_abbrev=False)
    p.add_argument('operation', choices=['inspect', 'install', 'uninstall', 'rollback', 'node', 'uninstall-node'])
    p.add_argument('--bundle-dir', default=str(Path(__file__).resolve().parents[1]))
    p.add_argument('--panel')
    p.add_argument('--session-file', help='owner-only file containing session_token=...; keep OUTSIDE this bundle')
    p.add_argument('--username', help='password is read with a hidden interactive prompt, never an argument')
    p.add_argument('--apply', action='store_true', help='explicitly authorize the displayed bounded operation')
    p.add_argument('--approve-route-plugin', action='store_true', help='approve node compatibility + HTTP routes, never exec/system RPC')
    p.add_argument('--activate', action='store_true', help='select the stable Enhanced theme after a verified install')
    p.add_argument('--backup-dir')
    p.add_argument('--previous-theme')
    p.add_argument('--previous-plugin')
    p.add_argument('--helpers-stopped', action='store_true')
    p.add_argument('--allow-loopback-http', action='store_true', help='literal loopback isolated tests only')
    p.add_argument('--allow-development-bundle', action='store_true', help='dirty development bundle, literal loopback tests ONLY')
    p.add_argument('--uuid')
    p.add_argument('--agent-config', help='explicitly authorize reading THIS node-local private Agent config; never modify Agent')
    p.add_argument('--prefix')
    p.add_argument('--state-dir')
    p.add_argument('--enable-local', action='store_true', help='explicitly permit local helper polling; panel policy remains separate and default OFF')
    p.add_argument('--run', action='store_true', help='run the installed fixed helper in foreground, never install a daemon implicitly')
    p.add_argument('--once', action='store_true')
    p.add_argument('--fixture-dir', help='local fixtures, literal loopback only; not a live trace')
    return p


def main():
    args = parser().parse_args()
    try:
        if sys.version_info < (3, 10) or not hasattr(__import__('os'), 'O_NOFOLLOW'):
            raise Refused('requires-Python-3.10-plus-on-POSIX')
        allow_development = False
        if args.allow_development_bundle:
            try:
                allow_development = bool(args.allow_loopback_http and ipaddress.ip_address(urllib.parse.urlsplit(args.panel or '').hostname or '').is_loopback)
            except ValueError:
                pass
            if not allow_development:
                raise Refused('development-bundles-only-on-explicit-literal-loopback')
        bundle = Bundle(args.bundle_dir, allow_development)
        if args.operation == 'inspect':
            result = {k: bundle.manifest[k] for k in ('product', 'version', 'commit', 'dirty', 'channel', 'modules', 'supportedKomari', 'realTracerouteValidated')}
        elif args.operation == 'node':
            if not all([args.panel, args.uuid, args.agent_config, args.prefix, args.state_dir]):
                raise Refused('node-needs-panel-uuid-agent-config-prefix-state-dir')
            result = enroll(bundle, args.panel, args.uuid, args.agent_config, args.prefix, args.state_dir, args.apply, args.allow_loopback_http, args.enable_local, args.run, args.once, args.fixture_dir)
        elif args.operation == 'uninstall-node':
            if not args.prefix or not args.state_dir:
                raise Refused('uninstall-node-needs-prefix-state-dir')
            result = uninstall_node(bundle, args.prefix, args.state_dir, args.apply, args.helpers_stopped)
        else:
            if not args.panel or (args.session_file and args.username):
                raise Refused('one-panel-and-one-authentication-source-required')
            api = API(args.panel, args.allow_loopback_http, args.session_file, args.username)
            if args.operation == 'rollback':
                if not args.backup_dir:
                    raise Refused('rollback-needs-private-backup-dir')
                directory, journal = load_journal(args.backup_dir, api)
                if journal['commit'] != bundle.manifest['commit']:
                    raise Refused('use-the-exact-Full-bundle-that-created-this-backup')
                if args.apply and not args.approve_route_plugin:
                    raise Refused('rollback-apply-needs-explicit-plugin-permission-approval')
                result = {'mode': 'dry-run', 'operation': 'rollback', 'restore': ['original-module-archives', 'plugin-policy-and-private-checkpoint-if-removed', 'original-active-theme'], 'unrelatedConfigurationChanged': False}
                if args.apply:
                    result = {'mode': 'apply', 'status': restore(api, bundle, directory, journal)}
            else:
                previous = {k: v for k, v in [('theme', args.previous_theme), ('plugin', args.previous_plugin)] if v}
                result = deploy(api, bundle, args.operation, args.apply, args.approve_route_plugin, args.backup_dir, previous, args.activate, args.helpers_stopped)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Refused as error:
        print('REFUSED: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile, __import__('tarfile').TarError, __import__('subprocess').CalledProcessError):
        print('REFUSED: invalid-private-file-package-or-native-response; no-raw-input-logged', file=sys.stderr)
        raise SystemExit(1)

if __name__ == '__main__':
    main()
