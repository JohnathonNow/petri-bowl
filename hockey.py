import torch
import torch.nn as nn
import torch.optim as optim
import random
import argparse
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Hockey Training</title>
    <style>
        canvas {
            border: 2px solid black;
            background-color: #e0f7fa;
        }
    </style>
</head>
<body>
    <h1>Hockey Training Watcher</h1>
    <h2 id="score">Score: 0 - 0</h2>
    <canvas id="gameCanvas" width="800" height="400"></canvas>
    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreElem = document.getElementById('score');

        // Map environment scale (100x50) to canvas scale (800x400)
        const scaleX = canvas.width / 100.0;
        const scaleY = canvas.height / 50.0;

        function drawGame(state) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw rounded rink boundary
            const r = 15 * scaleX; // radius
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(canvas.width - r, 0);
            ctx.arcTo(canvas.width, 0, canvas.width, r, r);
            ctx.lineTo(canvas.width, canvas.height - r);
            ctx.arcTo(canvas.width, canvas.height, canvas.width - r, canvas.height, r);
            ctx.lineTo(r, canvas.height);
            ctx.arcTo(0, canvas.height, 0, canvas.height - r, r);
            ctx.lineTo(0, r);
            ctx.arcTo(0, 0, r, 0, r);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw center line
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw goals (y between 15 and 35, x at 10 and 90)
            ctx.fillStyle = 'black';
            ctx.fillRect(10 * scaleX - 5, 15 * scaleY, 5, 20 * scaleY);
            ctx.fillRect(90 * scaleX, 15 * scaleY, 5, 20 * scaleY);

            // Draw team 1
            state.p1_pos.forEach((pos, idx) => {
                ctx.beginPath();
                ctx.arc(pos[0] * scaleX, pos[1] * scaleY, 5, 0, Math.PI * 2);
                ctx.fillStyle = idx === 0 ? 'darkblue' : 'blue'; // Goalie is dark blue
                ctx.fill();
            });

            // Draw team 2
            state.p2_pos.forEach((pos, idx) => {
                ctx.beginPath();
                ctx.arc(pos[0] * scaleX, pos[1] * scaleY, 5, 0, Math.PI * 2);
                ctx.fillStyle = idx === 0 ? 'darkred' : 'red'; // Goalie is dark red
                ctx.fill();
            });

            // Draw puck
            ctx.beginPath();
            ctx.arc(state.puck_pos[0] * scaleX, state.puck_pos[1] * scaleY, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'black';
            ctx.fill();

            scoreElem.innerText = `Score: ${state.score[0]} - ${state.score[1]}`;
        }

        async function fetchState() {
            try {
                const response = await fetch('/state');
                const state = await response.json();
                drawGame(state);
            } catch (e) {
                console.error("Error fetching state:", e);
            }
            setTimeout(fetchState, 50);
        }

        fetchState();
    </script>
</body>
</html>
"""

global_env = None

class HockeyHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode())
        elif self.path == '/state':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            if global_env:
                state = {
                    "p1_pos": global_env.p1_pos,
                    "p2_pos": global_env.p2_pos,
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

class PlayerNet(nn.Module):
    def __init__(self):
        super(PlayerNet, self).__init__()
        # Input: player x, player y, puck x, puck y, 11 other players' x, y
        self.fc1 = nn.Linear(26, 64)
        self.fc2 = nn.Linear(64, 5)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = self.fc2(x)
        return torch.softmax(x, dim=-1)

class HockeyEnv:
    def __init__(self):
        self.width = 100.0
        self.height = 50.0
        self.reset()

    def reset(self):
        self.score = [0, 0] # Team 1, Team 2
        self.steps = 0
        self._reset_positions()

    def step(self, actions1, actions2):
        self.steps += 1

        # actions: 0=up, 1=down, 2=left, 3=right, 4=stay
        speed = 0.2

        # move p1
        for i in range(len(self.p1_pos)):
            if actions1[i] == 0: self.p1_vel[i][1] -= speed
            elif actions1[i] == 1: self.p1_vel[i][1] += speed
            elif actions1[i] == 2: self.p1_vel[i][0] -= speed
            elif actions1[i] == 3: self.p1_vel[i][0] += speed
            
            self.p1_vel[i][0] *= 0.90
            self.p1_vel[i][1] *= 0.90
            
            self.p1_pos[i][0] += self.p1_vel[i][0]
            self.p1_pos[i][1] += self.p1_vel[i][1]
            self._apply_bounds(self.p1_pos[i], self.p1_vel[i])

        # move p2
        for i in range(len(self.p2_pos)):
            if actions2[i] == 0: self.p2_vel[i][1] -= speed
            elif actions2[i] == 1: self.p2_vel[i][1] += speed
            elif actions2[i] == 2: self.p2_vel[i][0] -= speed
            elif actions2[i] == 3: self.p2_vel[i][0] += speed
            
            self.p2_vel[i][0] *= 0.90
            self.p2_vel[i][1] *= 0.90
            
            self.p2_pos[i][0] += self.p2_vel[i][0]
            self.p2_pos[i][1] += self.p2_vel[i][1]
            self._apply_bounds(self.p2_pos[i], self.p2_vel[i])

        # Puck physics (simplified)
        self.puck_pos[0] += self.puck_vel[0]
        self.puck_pos[1] += self.puck_vel[1]

        # friction
        self.puck_vel[0] *= 0.95
        self.puck_vel[1] *= 0.95

        self._apply_bounds(self.puck_pos, self.puck_vel)

        # Goals (y between 15 and 35)
        goal_y_min = 15
        goal_y_max = 35

        if self.puck_pos[0] <= 10.0:
            if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                self.score[1] += 1
                self._reset_positions()
            else:
                self.puck_pos[0] = 10.0
                self.puck_vel[0] *= -1
        elif self.puck_pos[0] >= 90.0:
            if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                self.score[0] += 1
                self._reset_positions()
            else:
                self.puck_pos[0] = 90.0
                self.puck_vel[0] *= -1

        # Goalie constraints
        # Team 1 goalie
        self.p1_pos[0][0] = max(0.0, min(20.0, self.p1_pos[0][0]))
        self.p1_pos[0][1] = max(10.0, min(40.0, self.p1_pos[0][1]))
        
        # Team 2 goalie
        self.p2_pos[0][0] = max(80.0, min(100.0, self.p2_pos[0][0]))
        self.p2_pos[0][1] = max(10.0, min(40.0, self.p2_pos[0][1]))

        # Player-puck collisions
        def check_collision(p_pos):
            dx = self.puck_pos[0] - p_pos[0]
            dy = self.puck_pos[1] - p_pos[1]
            dist = (dx**2 + dy**2)**0.5
            if dist < 5.0: # collision radius
                if dist == 0:
                    self.puck_vel[0] += random.choice([-1.0, 1.0])
                    self.puck_vel[1] += random.choice([-1.0, 1.0])
                else:
                    self.puck_vel[0] += (dx/dist) * 2.0
                    self.puck_vel[1] += (dy/dist) * 2.0

        for p in self.p1_pos:
            check_collision(p)
        for p in self.p2_pos:
            check_collision(p)

        #print(self.p1_pos, self.p2_pos, self.puck_pos)
        done = self.steps >= 20000 #0
        return done

    def _apply_bounds(self, pos, vel, radius=15.0):
        # rectangular bounds
        if pos[0] < 0:
            pos[0] = 0
            vel[0] *= -1
        elif pos[0] > self.width:
            pos[0] = self.width
            vel[0] *= -1

        if pos[1] < 0:
            pos[1] = 0
            vel[1] *= -1
        elif pos[1] > self.height:
            pos[1] = self.height
            vel[1] *= -1

        # rounded corners
        corners = [
            (radius, radius),
            (self.width - radius, radius),
            (radius, self.height - radius),
            (self.width - radius, self.height - radius)
        ]
        
        for cx, cy in corners:
            # check if pos is in the square corner region
            if (pos[0] < radius and cx == radius) or (pos[0] > self.width - radius and cx == self.width - radius):
                if (pos[1] < radius and cy == radius) or (pos[1] > self.height - radius and cy == self.height - radius):
                    dx = pos[0] - cx
                    dy = pos[1] - cy
                    dist = (dx**2 + dy**2)**0.5
                    if dist > radius:
                        # project back to the circle
                        pos[0] = cx + (dx / dist) * radius
                        pos[1] = cy + (dy / dist) * radius
                        
                        # reflect velocity across normal
                        nx = dx / dist
                        ny = dy / dist
                        dot = vel[0] * nx + vel[1] * ny
                        vel[0] -= 2 * dot * nx
                        vel[1] -= 2 * dot * ny

    def _reset_positions(self):
        # 5 skaters, 1 goalie (index 0 is goalie)
        self.p1_pos = [
            [5.0, 25.0],
            [25.0, 10.0], [25.0, 25.0], [25.0, 40.0],
            [40.0, 15.0], [40.0, 35.0]
        ]
        self.p2_pos = [
            [95.0, 25.0],
            [75.0, 10.0], [75.0, 25.0], [75.0, 40.0],
            [60.0, 15.0], [60.0, 35.0]
        ]
        self.p1_vel = [[0.0, 0.0] for _ in range(6)]
        self.p2_vel = [[0.0, 0.0] for _ in range(6)]
        self.puck_pos = [50.0, 25.0]
        self.puck_vel = [0.0, 0.0]

def get_state(env, team, player_idx):
    if team == 1:
        my_pos = env.p1_pos[player_idx]
        other_players = [env.p1_pos[i] for i in range(len(env.p1_pos)) if i != player_idx] + env.p2_pos
    else:
        my_pos = env.p2_pos[player_idx]
        other_players = [env.p2_pos[i] for i in range(len(env.p2_pos)) if i != player_idx] + env.p1_pos

    state = [my_pos[0]/100.0, my_pos[1]/50.0, env.puck_pos[0]/100.0, env.puck_pos[1]/50.0]
    for p in other_players:
        state.extend([p[0]/100.0, p[1]/50.0])
    
    return torch.tensor(state, dtype=torch.float32)

def get_expert_action(px, py, tx, ty):
    dx = tx - px
    dy = ty - py
    if abs(dx) < 1.0 and abs(dy) < 1.0:
        return 4 # stay
    if abs(dx) > abs(dy):
        if dx > 0:
            return 3 # right
        else:
            return 2 # left
    else:
        if dy > 0:
            return 1 # down
        else:
            return 0 # up

def train(use_web=False):
    global global_env
    net1_skater = PlayerNet()
    net1_goalie = PlayerNet()
    net2_skater = PlayerNet()
    net2_goalie = PlayerNet()

    opt1_skater = optim.Adam(net1_skater.parameters(), lr=0.01)
    opt1_goalie = optim.Adam(net1_goalie.parameters(), lr=0.01)
    opt2_skater = optim.Adam(net2_skater.parameters(), lr=0.01)
    opt2_goalie = optim.Adam(net2_goalie.parameters(), lr=0.01)

    env = HockeyEnv()
    global_env = env

    if use_web:
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        print("Web UI running at http://localhost:8080/")

    print("Starting pre-training phase...")
    for _ in range(10):
        env.reset()
        for _ in range(20000): # max steps per pre-train epoch
            actions1 = []
            actions2 = []
            
            loss1_s = 0
            loss1_g = 0
            loss2_s = 0
            loss2_g = 0
            
            for i in range(6):
                # Team 1
                state1 = get_state(env, 1, i)
                if i == 0:
                    probs1 = net1_goalie(state1)
                    target_x, target_y = 5.0, env.puck_pos[1]
                else:
                    probs1 = net1_skater(state1)
                    if i in [1, 2]:
                        target_x, target_y = min(env.puck_pos[0], 45.0), env.puck_pos[1]
                    else:
                        target_x, target_y = env.puck_pos[0], env.puck_pos[1]
                
                m1 = torch.distributions.Categorical(probs1)
                action1 = m1.sample()
                actions1.append(action1.item())
                
                exp_a1 = get_expert_action(env.p1_pos[i][0], env.p1_pos[i][1], target_x, target_y)
                if i == 0:
                    loss1_g = loss1_g - torch.log(probs1[exp_a1] + 1e-8)
                else:
                    loss1_s = loss1_s - torch.log(probs1[exp_a1] + 1e-8)
                    if i in [1, 2] and env.p1_pos[i][0] < 50.0:
                        loss1_s -= 0.1
                    
                # Team 2
                state2 = get_state(env, 2, i)
                if i == 0:
                    probs2 = net2_goalie(state2)
                    target_x, target_y = 95.0, env.puck_pos[1]
                else:
                    probs2 = net2_skater(state2)
                    if i in [1, 2]:
                        target_x, target_y = max(env.puck_pos[0], 55.0), env.puck_pos[1]
                    else:
                        target_x, target_y = env.puck_pos[0], env.puck_pos[1]
                    
                m2 = torch.distributions.Categorical(probs2)
                action2 = m2.sample()
                actions2.append(action2.item())
                
                exp_a2 = get_expert_action(env.p2_pos[i][0], env.p2_pos[i][1], target_x, target_y)
                if i == 0:
                    loss2_g = loss2_g - torch.log(probs2[exp_a2] + 1e-8)
                else:
                    loss2_s = loss2_s - torch.log(probs2[exp_a2] + 1e-8)
                    if i in [1, 2] and env.p2_pos[i][0] > 50.0:
                        loss2_s -= 0.1

            opt1_skater.zero_grad()
            if type(loss1_s) != int:
                loss1_s.backward()
                opt1_skater.step()
                
            opt1_goalie.zero_grad()
            if type(loss1_g) != int:
                loss1_g.backward()
                opt1_goalie.step()
                
            opt2_skater.zero_grad()
            if type(loss2_s) != int:
                loss2_s.backward()
                opt2_skater.step()
                
            opt2_goalie.zero_grad()
            if type(loss2_g) != int:
                loss2_g.backward()
                opt2_goalie.step()

            done = env.step(actions1, actions2)
            if done:
                break
    print("Pre-training phase complete.")

    epochs = 100
    for epoch in range(epochs):
        env.reset()
        done = False

        log_probs1_skater = []
        log_probs1_goalie = []
        log_probs2_skater = []
        log_probs2_goalie = []

        while not done:
            actions1 = []
            actions2 = []

            for i in range(6):
                state1 = get_state(env, 1, i)
                if i == 0:
                    probs1 = net1_goalie(state1)
                else:
                    probs1 = net1_skater(state1)
                m1 = torch.distributions.Categorical(probs1)
                action1 = m1.sample()
                actions1.append(action1.item())
                if i == 0:
                    log_probs1_goalie.append(m1.log_prob(action1))
                else:
                    log_probs1_skater.append(m1.log_prob(action1))

                state2 = get_state(env, 2, i)
                if i == 0:
                    probs2 = net2_goalie(state2)
                else:
                    probs2 = net2_skater(state2)
                m2 = torch.distributions.Categorical(probs2)
                action2 = m2.sample()
                actions2.append(action2.item())
                if i == 0:
                    log_probs2_goalie.append(m2.log_prob(action2))
                else:
                    log_probs2_skater.append(m2.log_prob(action2))

            done = env.step(actions1, actions2)
            if use_web:
                time.sleep(0.01)

        reward1 = float(env.score[0] - env.score[1])
        reward2 = float(env.score[1] - env.score[0])

        loss1_skater = 0
        for lp in log_probs1_skater:
            loss1_skater = loss1_skater - lp * reward1

        loss1_goalie = 0
        for lp in log_probs1_goalie:
            loss1_goalie = loss1_goalie - lp * reward1

        opt1_skater.zero_grad()
        if type(loss1_skater) != int and loss1_skater.requires_grad:
            loss1_skater.backward()
            opt1_skater.step()

        opt1_goalie.zero_grad()
        if type(loss1_goalie) != int and loss1_goalie.requires_grad:
            loss1_goalie.backward()
            opt1_goalie.step()

        loss2_skater = 0
        for lp in log_probs2_skater:
            loss2_skater = loss2_skater - lp * reward2

        loss2_goalie = 0
        for lp in log_probs2_goalie:
            loss2_goalie = loss2_goalie - lp * reward2

        opt2_skater.zero_grad()
        if type(loss2_skater) != int and loss2_skater.requires_grad:
            loss2_skater.backward()
            opt2_skater.step()

        opt2_goalie.zero_grad()
        if type(loss2_goalie) != int and loss2_goalie.requires_grad:
            loss2_goalie.backward()
            opt2_goalie.step()

        if True: #epoch % 10 == 0:
            print(f"Epoch {epoch}: Score {env.score[0]} - {env.score[1]}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train a hockey AI")
    parser.add_argument("--web", action="store_true", help="Start web UI to watch training")
    args = parser.parse_args()

    train(use_web=args.web)


