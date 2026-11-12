"""Real loopback HTTP transport boundary tests (not native Komari evidence)."""
import http.server
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'distribution'))
from enhanced_full.api import API
from enhanced_full.safety import Refused, save_private

class TransportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='transport-unit-', dir=ROOT / 'test-results/full')
        self.path = Path(self.temporary.name)
        self.calls = []
        self.void = False
        self.redirect = False
        self.broken = False
        self.upload_bad = False
        self.target_hits = 0
        owner = self
        class Target(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                owner.target_hits += 1
                self.send_response(200)
                self.end_headers()
            def log_message(self, *args):
                pass
        self.target = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Target)
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))))
                owner.calls.append({'method': data.get('method'), 'cookie': self.headers.get('Cookie')})
                if owner.redirect:
                    self.send_response(302)
                    self.send_header('Location', f'http://127.0.0.1:{owner.target.server_port}/api/steal')
                    self.end_headers()
                    return
                result = {'id': data.get('id'), 'jsonrpc': '2.0'}
                if not owner.void:
                    result['result'] = {'version': '1.6.0'}
                if owner.broken:
                    result['error'] = {'message': 'UNIT-ONLY-DO-NOT-PRINT-THIS', 'code': -1}
                if self.path == '/api/admin/upload/init':
                    result = {'status': 'success', 'data': {'upload_id': 'not-a-native-uuid', 'chunk_size': 1024}}
                content = json.dumps(result).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(content)
            def log_message(self, *args):
                pass
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.threads = [threading.Thread(target=s.serve_forever, daemon=True) for s in (self.target, self.server)]
        for thread in self.threads:
            thread.start()
        self.panel = f'http://127.0.0.1:{self.server.server_port}'
        self.session = self.path / 'session'
        save_private(self.session, b'session_token=unit-only-private-session')
    def tearDown(self):
        for server in (self.server, self.target):
            server.shutdown()
            server.server_close()
        for thread in self.threads:
            thread.join()
        self.temporary.cleanup()
    def api(self):
        return API(self.panel, allow_loopback=True, session_file=self.session)
    def test_exact_origin_receives_cookie_header_never_url_or_body(self):
        response = self.api().rpc('public:getVersion')
        self.assertEqual(response['version'], '1.6.0')
        self.assertEqual(self.calls, [{'method': 'public:getVersion', 'cookie': 'session_token=unit-only-private-session'}])
    def test_redirect_never_forwards_cookie_or_request_to_another_origin(self):
        self.redirect = True
        with self.assertRaisesRegex(Refused, 'redirect-refused'):
            self.api().rpc('public:getVersion')
        self.assertEqual(self.target_hits, 0)
    def test_native_void_ACK_is_allowed_only_for_actual_void_methods(self):
        self.void = True
        self.assertIsNone(self.api().rpc('admin:setPluginConfiguration', {'short': 'enhanced-route-probe', 'data': {}}))
        self.assertIsNone(self.api().rpc('admin:setPluginEnabled', {'short': 'enhanced-route-probe', 'enabled': False}))
        with self.assertRaises(Refused):
            self.api().rpc('public:getVersion')
    def test_rpc_error_never_echoes_upstream_body_or_credentials(self):
        self.broken = True
        with self.assertRaisesRegex(Refused, '^native-rpc-rejected-request$'):
            self.api().rpc('public:getVersion')
    def test_invalid_native_upload_identifier_is_not_repaired_or_used(self):
        with self.assertRaisesRegex(Refused, 'invalid-upload-session'):
            self.api().upload('theme', b'unit-archive-content')
        self.assertEqual(len(self.calls), 1)
    def test_proxy_environment_is_not_used_for_a_credentialed_request(self):
        with patch.dict('os.environ', {'HTTP_PROXY': f'http://127.0.0.1:{self.target.server_port}', 'NO_PROXY': ''}):
            self.assertEqual(self.api().rpc('public:getVersion')['version'], '1.6.0')
        self.assertEqual(self.target_hits, 0)
    def test_malformed_jsonrpc_protocol_and_boolean_id_are_not_accepted(self):
        api = self.api()
        with patch.object(api, 'json', return_value={'jsonrpc': '2.0', 'id': True, 'result': None}), self.assertRaises(Refused):
            api.rpc('admin:setPluginEnabled')
        with patch.object(api, 'json', return_value={'jsonrpc': '1.0', 'id': 2, 'result': {'version': 'wrong'}}), self.assertRaises(Refused):
            api.rpc('public:getVersion')
        with patch.object(api, 'raw', return_value=b'[]'), self.assertRaisesRegex(Refused, 'non-object'):
            api.json('/api/version')
    def test_cookie_file_injection_world_readable_or_symlink_are_rejected(self):
        save_private(self.session, b'session_token=unit\r\nOther=unsafe')
        with self.assertRaises(Refused):
            self.api()
        save_private(self.session, b'session_token=unit-only-private-session')
        self.session.chmod(0o644)
        with self.assertRaises(Refused):
            self.api()
        self.session.chmod(0o600)
        link = self.path / 'link'
        link.symlink_to(self.session)
        with self.assertRaises(OSError):
            API(self.panel, allow_loopback=True, session_file=link)

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TransportTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {'kind': 'real-loopback-HTTP-with-explicit-mock-server', 'run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped)}
    (ROOT / 'test-results/full/transport-unit.json').write_text(json.dumps(report, indent=2) + '\n')
    sys.exit(not result.wasSuccessful())
