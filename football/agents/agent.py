import math
import torch
import torch.optim as optim
from agents.models import PlayerNet
from constants import CONSTANTS

def get_state(env, team, player_idx, play_call):
    if team == 1:
        my_pos = env.p1_pos[player_idx]
        teammates = [env.p1_pos[i] for i in range(len(env.p1_pos)) if i != player_idx]
        opponents = env.p2_pos
    else:
        my_pos = env.p2_pos[player_idx]
        teammates = [env.p2_pos[i] for i in range(len(env.p2_pos)) if i != player_idx]
        opponents = env.p1_pos

    all_other_players = teammates + opponents

    def get_distance_bucket(dx, dy):
        dist = (dx**2 + dy**2)**0.5
        if dist == 0: return 0
        elif dist <= 4: return int(dist) # 1, 2, 3, 4
        elif dist <= 32: return 5
        elif dist <= 128: return 6
        else: return 7

    state = [float(play_call)]

    for p in all_other_players:
        bucket = get_distance_bucket(p[0] - my_pos[0], p[1] - my_pos[1])
        state.append(float(bucket))

    state.append(my_pos[0] / CONSTANTS["WIDTH"])
    state.append(my_pos[1] / CONSTANTS["HEIGHT"])
    state.append(1.0 if env.can_throw else 0.0)

    return torch.tensor(state, dtype=torch.float32)


class Agent:
    def __init__(self):
        self.net = PlayerNet()
        self.opt = optim.Adam(self.net.parameters(), lr=CONSTANTS["LR"])
        self.log_probs = []

    def get_action(self, state):
        dir_probs, speed_probs, pass_probs = self.net(state)
        m_dir = torch.distributions.Categorical(dir_probs)
        m_speed = torch.distributions.Categorical(speed_probs)
        m_pass = torch.distributions.Categorical(pass_probs)

        dir_action = m_dir.sample()
        speed_action = m_speed.sample()
        pass_action = m_pass.sample()

        total_log_prob = m_dir.log_prob(dir_action) + m_speed.log_prob(speed_action) + m_pass.log_prob(pass_action)
        return (dir_action.item(), speed_action.item(), pass_action.item()), total_log_prob


class Team:
    def __init__(self):
        self.agents = [Agent() for _ in range(11)]
