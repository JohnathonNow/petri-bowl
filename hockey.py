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
            ctx.fillRect(10 * scaleX - 5, 21 * scaleY, 5, 8 * scaleY);
            ctx.fillRect(90 * scaleX, 21 * scaleY, 5, 8 * scaleY);

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
            self._resolve_net_collision(self.p1_pos[i], self.p1_vel[i], False)

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
            self._resolve_net_collision(self.p2_pos[i], self.p2_vel[i], False)

        # Puck physics (simplified)
        old_puck_x = self.puck_pos[0]
        self.puck_pos[0] += self.puck_vel[0]
        self.puck_pos[1] += self.puck_vel[1]

        # friction
        self.puck_vel[0] *= 0.95
        self.puck_vel[1] *= 0.95

        self._apply_bounds(self.puck_pos, self.puck_vel)

        # Goals (y between 15 and 35)
        goal_y_min = 21
        goal_y_max = 29

        scored_goal = False
        if old_puck_x > 10.0 and self.puck_pos[0] <= 10.0:
            if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                self.score[1] += 1
                self._reset_positions()
                scored_goal = True
        elif old_puck_x < 90.0 and self.puck_pos[0] >= 90.0:
            if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                self.score[0] += 1
                self._reset_positions()
                scored_goal = True

        if not scored_goal:
            self._resolve_net_collision(self.puck_pos, self.puck_vel, True)

        # Goalie constraints
        # Team 1 goalie
        self.p1_pos[0][0] = max(10.0, min(20.0, self.p1_pos[0][0]))
        self.p1_pos[0][1] = max(10.0, min(40.0, self.p1_pos[0][1]))
        
        # Team 2 goalie
        self.p2_pos[0][0] = max(80.0, min(90.0, self.p2_pos[0][0]))
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

    def _resolve_net_collision(self, pos, vel, is_puck):
        # Team 1 net: x in [5, 10], y in [21, 29]
        if 5.0 <= pos[0] <= 10.0 and 21.0 <= pos[1] <= 29.0:
            dx1 = pos[0] - 5.0
            dx2 = 10.0 - pos[0]
            dy1 = pos[1] - 21.0
            dy2 = 29.0 - pos[1]
            min_d = min(dx1, dx2, dy1, dy2)
            
            if min_d == dx1:
                pos[0] = 5.0
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dx2:
                pos[0] = 10.0
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dy1:
                pos[1] = 21.0
                vel[1] = -vel[1] if is_puck else 0.0
            else:
                pos[1] = 29.0
                vel[1] = -vel[1] if is_puck else 0.0
                
        # Team 2 net: x in [90, 95], y in [21, 29]
        elif 90.0 <= pos[0] <= 95.0 and 21.0 <= pos[1] <= 29.0:
            dx1 = pos[0] - 90.0
            dx2 = 95.0 - pos[0]
            dy1 = pos[1] - 21.0
            dy2 = 29.0 - pos[1]
            min_d = min(dx1, dx2, dy1, dy2)
            
            if min_d == dx1:
                pos[0] = 90.0
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dx2:
                pos[0] = 95.0
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dy1:
                pos[1] = 21.0
                vel[1] = -vel[1] if is_puck else 0.0
            else:
                pos[1] = 29.0
                vel[1] = -vel[1] if is_puck else 0.0

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
            [12.0, 25.0],
            [25.0, 10.0], [25.0, 25.0], [25.0, 40.0],
            [40.0, 15.0], [40.0, 35.0]
        ]
        self.p2_pos = [
            [88.0, 25.0],
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
class Agent:
    def __init__(self, is_goalie=False):
        self.net = PlayerNet()
        self.opt = optim.Adam(self.net.parameters(), lr=0.01)
        self.log_probs = []
        self.is_goalie = is_goalie

    def get_action(self, state):
        probs = self.net(state)
        m = torch.distributions.Categorical(probs)
        action = m.sample()
        return action.item(), m.log_prob(action)

    def get_action_pretrain(self, state, expert_action):
        probs = self.net(state)
        m = torch.distributions.Categorical(probs)
        action = m.sample()
        loss = -torch.log(probs[expert_action] + 1e-8)
        return action.item(), loss

class Team:
    def __init__(self):
        # Index 0 is goalie, 1-5 are skaters
        self.agents = [Agent(is_goalie=True)] + [Agent(is_goalie=False) for _ in range(5)]

pretrain=True
def train(use_web=False):
    global global_env
    team1 = Team()
    team2 = Team()

    env = HockeyEnv()
    global_env = env

    if use_web:
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        print("Web UI running at http://localhost:8080/", flush=True)

    print("Starting pre-training phase...", flush=True)
    for _ in range(5):
        env.reset()
        for _ in range(400): # max steps per pre-train epoch
            actions1 = []
            actions2 = []
            
            losses = []
            
            for i in range(6):
                # Team 1
                state1 = get_state(env, 1, i)
                if i == 0:
                    target_x, target_y = 12.0, env.puck_pos[1]
                else:
                    if i in [1, 2]:
                        target_x, target_y = min(env.puck_pos[0], 45.0), env.puck_pos[1]
                    else:
                        target_x, target_y = env.puck_pos[0], env.puck_pos[1]
                
                exp_a1 = get_expert_action(env.p1_pos[i][0], env.p1_pos[i][1], target_x, target_y)
                action1, loss1 = team1.agents[i].get_action_pretrain(state1, exp_a1)

                if i in [1, 2] and env.p1_pos[i][0] > 50.0:
                    loss1 = loss1 * 5.0
                actions1.append(action1)
                losses.append((team1.agents[i], loss1))
                    
                # Team 2
                state2 = get_state(env, 2, i)
                if i == 0:
                    target_x, target_y = 88.0, env.puck_pos[1]
                else:
                    if i in [1, 2]:
                        target_x, target_y = max(env.puck_pos[0], 55.0), env.puck_pos[1]
                    else:
                        target_x, target_y = env.puck_pos[0], env.puck_pos[1]
                    
                exp_a2 = get_expert_action(env.p2_pos[i][0], env.p2_pos[i][1], target_x, target_y)
                action2, loss2 = team2.agents[i].get_action_pretrain(state2, exp_a2)
                
                if i in [1, 2] and env.p2_pos[i][0] < 50.0:
                    loss2 = loss2 * 5.0
                actions2.append(action2)
                losses.append((team2.agents[i], loss2))

            for agent, loss in losses:
                agent.opt.zero_grad()
                if type(loss) != int and loss.requires_grad:
                    loss.backward()
                    agent.opt.step()

            done = env.step(actions1, actions2)
            if done:
                break
    print("Pre-training phase complete.", flush=True)
    pretrain=False

    epochs = 100
    for epoch in range(epochs):
        env.reset()
        done = False

        # Clear log probs for new episode
        for team in [team1, team2]:
            for agent in team.agents:
                agent.log_probs = []

        while not done:
            actions1 = []
            actions2 = []

            for i in range(6):
                state1 = get_state(env, 1, i)
                action1, log_prob1 = team1.agents[i].get_action(state1)
                actions1.append(action1)
                team1.agents[i].log_probs.append(log_prob1)

                state2 = get_state(env, 2, i)
                action2, log_prob2 = team2.agents[i].get_action(state2)
                actions2.append(action2)
                team2.agents[i].log_probs.append(log_prob2)

            done = env.step(actions1, actions2)

        reward1 = float(env.score[0] - env.score[1])
        reward2 = float(env.score[1] - env.score[0])

        for team, reward in [(team1, reward1), (team2, reward2)]:
            for agent in team.agents:
                loss = 0
                for lp in agent.log_probs:
                    loss = loss - lp * reward

                agent.opt.zero_grad()
                if type(loss) != int and loss.requires_grad:
                    loss.backward()
                    agent.opt.step()

        if True: #epoch % 10 == 0:
            print(f"Epoch {epoch}: Score {env.score[0]} - {env.score[1]}", flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train a hockey AI")
    parser.add_argument("--web", action="store_true", help="Start web UI to watch training")
    args = parser.parse_args()

    train(use_web=args.web)



