from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import threading
from urllib.parse import urlparse
import sys
import os

from constants import CONSTANTS

global_env = None
global_teams = []
uploaded_model = None

def set_global_env(env):
    global global_env
    global_env = env

def set_global_teams(teams):
    global global_teams
    global_teams = teams

def get_uploaded_model():
    global uploaded_model
    model = uploaded_model
    uploaded_model = None # Clear after fetching
    return model

class RequestHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = super().translate_path(path)
        # Force it to look in hockey/web if it's looking for index.html or goal_horn.mp3 etc in cwd
        if 'goal_horn.mp3' in path and not 'hockey/web/goal_horn.mp3' in path:
            return path.replace('goal_horn.mp3', 'hockey/web/goal_horn.mp3')
        return path
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path.endswith('/constants'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(CONSTANTS).encode())
            return

        if parsed_path.path.endswith('/export_architecture'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            # Export architecture-related constants
            arch_constants = {
                "INPUT_SIZE": CONSTANTS.get("INPUT_SIZE"),
                "HIDDEN_SIZE_1": CONSTANTS.get("HIDDEN_SIZE_1"),
                "HIDDEN_SIZE_2": CONSTANTS.get("HIDDEN_SIZE_2"),
                "OUTPUT_SIZE_MOVE": CONSTANTS.get("OUTPUT_SIZE_MOVE"),
                "OUTPUT_SIZE_STICK": CONSTANTS.get("OUTPUT_SIZE_STICK")
            }
            self.wfile.write(json.dumps(arch_constants).encode())
            return

        if parsed_path.path.endswith('/export_weights'):
            if not global_teams or not global_teams[0].agents:
                self.send_response(404)
                self.end_headers()
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            # Export weights of the first agent from team 1
            agent = global_teams[0].agents[0]
            state_dict = agent.net.state_dict()

            # Convert tensors to nested lists for JSON serialization
            weights = {}
            for key, tensor in state_dict.items():
                weights[key] = tensor.cpu().tolist()

            self.wfile.write(json.dumps(weights).encode())
            return

        if parsed_path.path.endswith('/state'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if global_env:
                # Return the state that the UI actually draws
                state = {
                    "p1_pos": global_env.p1_pos,
                    "p1_stick_angle": global_env.p1_stick_angle,
                    "p2_pos": global_env.p2_pos,
                    "p2_stick_angle": global_env.p2_stick_angle,
                    "ref_pos": global_env.ref_pos,
                    "puck_pos": global_env.puck_pos,
                    "score": global_env.score,
                    "is_replay": getattr(global_env, 'is_replay', False),
                    "play_horn": getattr(global_env, 'play_horn', False)
                }
                # Reset horn after sending to clients
                if hasattr(global_env, 'play_horn') and global_env.play_horn:
                    global_env.play_horn = False

                self.wfile.write(json.dumps(state).encode())
            else:
                self.wfile.write(json.dumps({}).encode())
            return

        if parsed_path.path == '/' or parsed_path.path == '/hockey' or parsed_path.path == '/hockey/':
            self.path = '/hockey/web/index.html'

        return super().do_GET()

    def do_POST(self):
        global uploaded_model
        parsed_path = urlparse(self.path)

        if parsed_path.path.endswith('/upload_model'):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                uploaded_model = json.loads(post_data.decode('utf-8'))
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    server_address = ('', 8081)
    # Important: Ensure the server runs relative to the project root
    # so simple HTTP server resolves paths correctly if requested
    httpd = HTTPServer(server_address, RequestHandler)
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
