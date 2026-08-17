import http.server
import socketserver
import urllib.request
import threading
from urllib.parse import urlparse

PORT = 8080

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Mapping prefixes to target ports
        # Assuming: Hockey=8081, Soccer=8082, Football=8083
        routes = {
            '/hockey': 'http://localhost:8081',
            '/soccer': 'http://localhost:8082',
            '/football': 'http://localhost:8083'
        }

        target_url = None
        for prefix, target in routes.items():
            if path.startswith(prefix):
                # Strip the prefix and forward
                rest_of_path = path[len(prefix):]
                if not rest_of_path.startswith('/'):
                    rest_of_path = '/' + rest_of_path
                target_url = target + rest_of_path
                if parsed_path.query:
                    target_url += '?' + parsed_path.query
                break

        # Serve the retro-football directly without proxying
        if path.startswith('/retro-football'):
            if path == '/retro-football' or path == '/retro-football/':
                self.path = '/retro-football/index.html'
            return super().do_GET()

        if target_url:
            try:
                req = urllib.request.Request(target_url, headers=self.headers)
                with urllib.request.urlopen(req) as response:
                    self.send_response(response.status)
                    for k, v in response.headers.items():
                        self.send_header(k, v)
                    self.end_headers()
                    self.wfile.write(response.read())
            except Exception as e:
                self.send_error(500, f"Proxy error: {str(e)}")
        else:
            # Serve the main index.html for root or unknown paths
            if path == '/' or path == '/index.html':
                self.path = '/web/index.html'
            super().do_GET()

with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
    print(f"Proxy serving at port {PORT}")
    httpd.serve_forever()
