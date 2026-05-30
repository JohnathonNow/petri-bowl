import torch
import torch.nn as nn
import torch.optim as optim
import random

class PlayerNet(nn.Module):
    def __init__(self):
        super(PlayerNet, self).__init__()
        # Input: player x, player y, puck x, puck y
        self.fc1 = nn.Linear(4, 16)
        self.fc2 = nn.Linear(16, 4)

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
        # 1 player per team for simplicity
        self.p1_pos = [25.0, 25.0]
        self.p2_pos = [75.0, 25.0]
        self.puck_pos = [50.0, 25.0]
        self.puck_vel = [0.0, 0.0]
        self.score = [0, 0] # Team 1, Team 2
        self.steps = 0

    def step(self, action1, action2):
        self.steps += 1

        # actions: 0=up, 1=down, 2=left, 3=right
        speed = 2.0

        # move p1
        if action1 == 0: self.p1_pos[1] -= speed
        elif action1 == 1: self.p1_pos[1] += speed
        elif action1 == 2: self.p1_pos[0] -= speed
        elif action1 == 3: self.p1_pos[0] += speed

        # move p2
        if action2 == 0: self.p2_pos[1] -= speed
        elif action2 == 1: self.p2_pos[1] += speed
        elif action2 == 2: self.p2_pos[0] -= speed
        elif action2 == 3: self.p2_pos[0] += speed

        # Keep players in bounds
        self.p1_pos[0] = max(0, min(self.width, self.p1_pos[0]))
        self.p1_pos[1] = max(0, min(self.height, self.p1_pos[1]))
        self.p2_pos[0] = max(0, min(self.width, self.p2_pos[0]))
        self.p2_pos[1] = max(0, min(self.height, self.p2_pos[1]))

        # Puck physics (simplified)
        self.puck_pos[0] += self.puck_vel[0]
        self.puck_pos[1] += self.puck_vel[1]

        # friction
        self.puck_vel[0] *= 0.95
        self.puck_vel[1] *= 0.95

        # Wall bounces for puck
        if self.puck_pos[1] <= 0:
            self.puck_pos[1] = 0
            self.puck_vel[1] *= -1
        elif self.puck_pos[1] >= self.height:
            self.puck_pos[1] = self.height
            self.puck_vel[1] *= -1

        # Goals (y between 15 and 35)
        goal_y_min = 15
        goal_y_max = 35

        if self.puck_pos[0] <= 0:
            if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                self.score[1] += 1
                self._reset_positions()
            else:
                self.puck_pos[0] = 0
                self.puck_vel[0] *= -1
        elif self.puck_pos[0] >= self.width:
            if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                self.score[0] += 1
                self._reset_positions()
            else:
                self.puck_pos[0] = self.width
                self.puck_vel[0] *= -1

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

        check_collision(self.p1_pos)
        check_collision(self.p2_pos)

        #print(self.p1_pos, self.p2_pos, self.puck_pos)
        done = self.steps >= 20000 #0
        return done

    def _reset_positions(self):
        self.p1_pos = [25.0, 25.0]
        self.p2_pos = [75.0, 25.0]
        self.puck_pos = [50.0, 25.0]
        self.puck_vel = [0.0, 0.0]

def train():
    net1 = PlayerNet()
    net2 = PlayerNet()
    opt1 = optim.Adam(net1.parameters(), lr=0.01)
    opt2 = optim.Adam(net2.parameters(), lr=0.01)

    env = HockeyEnv()

    epochs = 100
    for epoch in range(epochs):
        env.reset()
        done = False

        log_probs1 = []
        log_probs2 = []

        while not done:
            state1 = torch.tensor([env.p1_pos[0]/100.0, env.p1_pos[1]/50.0, env.puck_pos[0]/100.0, env.puck_pos[1]/50.0], dtype=torch.float32)
            probs1 = net1(state1)
            m1 = torch.distributions.Categorical(probs1)
            action1 = m1.sample()
            log_probs1.append(m1.log_prob(action1))

            state2 = torch.tensor([env.p2_pos[0]/100.0, env.p2_pos[1]/50.0, env.puck_pos[0]/100.0, env.puck_pos[1]/50.0], dtype=torch.float32)
            probs2 = net2(state2)
            m2 = torch.distributions.Categorical(probs2)
            action2 = m2.sample()
            log_probs2.append(m2.log_prob(action2))

            done = env.step(action1.item(), action2.item())

        reward1 = float(env.score[0] - env.score[1])
        reward2 = float(env.score[1] - env.score[0])

        loss1 = 0
        for lp in log_probs1:
            loss1 = loss1 - lp * reward1

        opt1.zero_grad()
        if type(loss1) != int and loss1.requires_grad:
            loss1.backward()
            opt1.step()

        loss2 = 0
        for lp in log_probs2:
            loss2 = loss2 - lp * reward2

        opt2.zero_grad()
        if type(loss2) != int and loss2.requires_grad:
            loss2.backward()
            opt2.step()

        if True: #epoch % 10 == 0:
            print(f"Epoch {epoch}: Score {env.score[0]} - {env.score[1]}")

if __name__ == '__main__':
    train()
