import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

from constants import CONSTANTS
from env.soccer_env import SoccerEnv

global_env: SoccerEnv = None
global_teams = None
uploaded_model_data = None

def set_global_env(env):
    global global_env
    global_env = env

def set_global_teams(teams):
    global global_teams
    global_teams = teams

def get_uploaded_model():
    global uploaded_model_data
    model_data = uploaded_model_data
    uploaded_model_data = None
    return model_data

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

        elif self.path == '/export_architecture':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            arch = {
                "NET_INPUT": CONSTANTS["NET_INPUT"],
                "NET_HIDDEN1": CONSTANTS["NET_HIDDEN1"],
                "NET_HIDDEN2": CONSTANTS["NET_HIDDEN2"],
                "NET_OUT_MOVE": CONSTANTS["NET_OUT_MOVE"],
                "NET_OUT_STICK": CONSTANTS["NET_OUT_STICK"]
            }
            self.wfile.write(json.dumps(arch).encode())

        elif self.path == '/export_weights':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            weights = {}
            if global_teams and len(global_teams) > 0:
                agent = global_teams[0].agents[1]
                state_dict = agent.net.state_dict()
                for key, val in state_dict.items():
                    weights[key] = val.tolist()
            self.wfile.write(json.dumps(weights).encode())

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
                    "ball_pos": global_env.ball_pos,
                    "score": global_env.score,
                    "is_replay": getattr(global_env, 'is_replay', False),
                    "play_horn": getattr(global_env, 'play_horn', False)
                }
            else:
                state = {}

            self.wfile.write(json.dumps(state).encode())

        elif self.path == '/goal_horn.mp3':
            try:
                audio_path = os.path.join(os.path.dirname(__file__), 'goal_horn.mp3')
                with open(audio_path, 'rb') as f:
                    audio_content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'audio/mpeg')
                self.end_headers()
                self.wfile.write(audio_content)
            except FileNotFoundError:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/upload_model':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                global uploaded_model_data
                uploaded_model_data = data
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress logging
        pass

def run_server():
    server = HTTPServer(('localhost', 8080), HockeyHTTPRequestHandler)
    server.serve_forever()
