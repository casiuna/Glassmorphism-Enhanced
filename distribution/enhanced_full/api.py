"""Only documented Komari 1.6.0 administrator APIs; never follow redirects."""
import getpass
import http.cookiejar
import json
import secrets
import urllib.error
import urllib.request
from .safety import UUID, Refused, origin, private_bytes

ROOT = '/api/enhanced-route-probe/v1'
SHORT = 'enhanced-route-probe'
THEME = 'Enhanced'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Refused('redirect-refused')

class API:
    def __init__(self, panel, allow_loopback=False, session_file=None, username=None, agent=False):
        self.panel = origin(panel, allow_loopback)
        self.cookie = ''
        self.sequence = 0
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        if session_file:
            value = private_bytes(session_file, 8192).decode().strip()
            if not value.startswith('session_token=') or any(ord(c) < 33 or ord(c) > 126 for c in value) or ';' in value:
                raise Refused('invalid-private-session-file')
            self.cookie = value
        elif username:
            self.rest('/api/login', {'username': username, 'password': getpass.getpass('Komari password (not logged): ')})
        elif not agent:
            raise Refused('private-session-file-or-interactive-username-required')

    def raw(self, path, data=None, content_type='application/json'):
        if not path.startswith('/api/') or path.startswith('//') or '\r' in path or '\n' in path:
            raise Refused('api-path-refused')
        headers = {'X-Enhanced-Route': '1', 'Content-Type': content_type}
        if self.cookie:
            headers['Cookie'] = self.cookie
        request = urllib.request.Request(self.panel + path, data=data, headers=headers, method='POST' if data is not None else 'GET')
        try:
            with self.opener.open(request, timeout=30) as response:
                result = response.read(8388609)
                if len(result) > 8388608:
                    raise Refused('api-response-limit')
                return result
        except urllib.error.HTTPError as error:
            # No response bodies, URL strings or exception reprs: an upstream
            # proxy can echo credentials or arbitrary input in an error page.
            raise Refused('HTTP-' + str(error.code)) from None
        except (urllib.error.URLError, TimeoutError):
            raise Refused('network-or-tls-failure') from None

    def json(self, path, data=None):
        try:
            result = json.loads(self.raw(path, None if data is None else json.dumps(data).encode()))
        except (ValueError, UnicodeError):
            raise Refused('non-json-api-response') from None
        if not isinstance(result, dict):
            raise Refused('non-object-json-api-response')
        return result

    def rest(self, path, data=None):
        result = self.json(path, data)
        if result.get('status') != 'success':
            raise Refused('native-api-rejected-request')
        return result.get('data')

    def rpc(self, method, params=None):
        self.sequence += 1
        result = self.json('/api/rpc2', {'jsonrpc': '2.0', 'id': self.sequence, 'method': method, 'params': params or {}})
        void_methods = {'admin:editSettings', 'admin:setPluginConfiguration', 'admin:setPluginEnabled', 'admin:deletePlugin'}
        if result.get('error') or result.get('jsonrpc') != '2.0' or type(result.get('id')) is not int or result.get('id') != self.sequence or ('result' not in result and method not in void_methods):
            raise Refused('native-rpc-rejected-request')
        return result.get('result')

    def upload(self, purpose, content):
        if purpose not in ('theme', 'plugin'):
            raise Refused('upload-purpose-refused')
        session = self.rest('/api/admin/upload/init', {'purpose': purpose, 'filename': purpose + '.zip', 'size': len(content)})
        if not isinstance(session, dict):
            raise Refused('invalid-upload-session')
        upload_id, size = session.get('upload_id'), session.get('chunk_size')
        if not isinstance(upload_id, str) or not UUID.fullmatch(upload_id) or not isinstance(size, int) or not 1 <= size <= 8388608:
            raise Refused('invalid-upload-session')
        for index, offset in enumerate(range(0, len(content), size)):
            boundary = 'Enhanced' + secrets.token_hex(16)
            fields = b''
            for key, value in [('upload_id', upload_id), ('chunk_index', str(index))]:
                fields += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
            fields += f'--{boundary}\r\nContent-Disposition: form-data; name="chunk_data"; filename="chunk"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
            fields += content[offset:offset + size] + f'\r\n--{boundary}--\r\n'.encode()
            result = json.loads(self.raw('/api/admin/upload/chunk', fields, 'multipart/form-data; boundary=' + boundary))
            if result.get('status') != 'success':
                raise Refused('upload-chunk-rejected')
        self.rest('/api/admin/upload/merge', {'upload_id': upload_id})

    def plugin_config(self):
        return self.rpc('admin:getPluginConfiguration', {'short': SHORT})['data']

    def set_config(self, value):
        self.rpc('admin:setPluginConfiguration', {'short': SHORT, 'data': value})
        if self.plugin_config() != value:
            raise Refused('plugin-configuration-readback-mismatch')

    def enabled(self, enabled, approved=False):
        result = self.rpc('admin:setPluginEnabled', {'short': SHORT, 'enabled': enabled, 'approved': approved})
        if result and result.get('requires_approval'):
            raise Refused('explicit-plugin-permission-approval-required')

    def activate(self, short):
        # JSON body avoids putting even non-secret user-selected values in URLs.
        self.rpc('admin:editSettings', {'theme': short})
        if self.rpc('public:getPublicSettings')['theme'] != short:
            raise Refused('theme-activation-readback-mismatch')
