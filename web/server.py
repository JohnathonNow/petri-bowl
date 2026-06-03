import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

from constants import CONSTANTS
from env.hockey_env import HockeyEnv

global_env: HockeyEnv = None

def set_global_env(env):
    global global_env
    global_env = env

class HockeyHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()

            # Read and serve the index.html file
            html_path = os.path.join(os.path.dirname(__file__), 'index.html')
            with open(html_path, 'r') as f:
                html_content = f.read()
            self.wfile.write(html_content.encode())

        elif self.path == '/constants':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(CONSTANTS).encode())

        elif self.path == '/state':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            if global_env:
                state = {
                    "p1_pos": global_env.p1_pos,
                    "p2_pos": global_env.p2_pos,
                    "p1_stick_angle": global_env.p1_stick_angle,
                    "p2_stick_angle": global_env.p2_stick_angle,
                    "puck_pos": global_env.puck_pos,
                    "score": global_env.score
                }
            else:
                state = {}

            self.wfile.write(json.dumps(state).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress logging
        pass

def run_server():
    server = HTTPServer(('localhost', 8080), HockeyHTTPRequestHandler)
    server.serve_forever()
