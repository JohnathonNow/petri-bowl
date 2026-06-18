import math
import torch
import torch.optim as optim
from agents.models import PlayerNet
from constants import CONSTANTS

def get_state(env, team, player_idx):
    if team == 1:
        my_pos = env.p1_pos[player_idx]
        my_angle = env.p1_stick_angle[player_idx]
        other_players = [env.p1_pos[i] for i in range(len(env.p1_pos)) if i != player_idx] + env.p2_pos
        other_angles = [env.p1_stick_angle[i] for i in range(len(env.p1_stick_angle)) if i != player_idx] + env.p2_stick_angle
    else:
        my_pos = env.p2_pos[player_idx]
        my_angle = env.p2_stick_angle[player_idx]
        other_players = [env.p2_pos[i] for i in range(len(env.p2_pos)) if i != player_idx] + env.p1_pos
        other_angles = [env.p2_stick_angle[i] for i in range(len(env.p2_stick_angle)) if i != player_idx] + env.p1_stick_angle

    state = [
        my_pos[0] / CONSTANTS["WIDTH"],
        my_pos[1] / CONSTANTS["HEIGHT"],
        env.ball_pos[0] / CONSTANTS["WIDTH"],
        env.ball_pos[1] / CONSTANTS["HEIGHT"],
        math.cos(my_angle),
        math.sin(my_angle)
    ]
    for p, a in zip(other_players, other_angles):
        state.extend([p[0] / CONSTANTS["WIDTH"], p[1] / CONSTANTS["HEIGHT"], math.cos(a), math.sin(a)])

    return torch.tensor(state, dtype=torch.float32)

def get_expert_action(px, py, tx, ty):
    dx = tx - px
    dy = ty - py
    if abs(dx) < CONSTANTS["EXPERT_ACTION_TOL"] and abs(dy) < CONSTANTS["EXPERT_ACTION_TOL"]:
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
        self.opt = optim.Adam(self.net.parameters(), lr=CONSTANTS["LR"])
        self.log_probs = []
        self.is_goalie = is_goalie

    def get_action(self, state):
        move_probs, stick_probs = self.net(state)
        m_move = torch.distributions.Categorical(move_probs)
        m_stick = torch.distributions.Categorical(stick_probs)
        move_action = m_move.sample()
        stick_action = m_stick.sample()
        return (move_action.item(), stick_action.item()), m_move.log_prob(move_action) + m_stick.log_prob(stick_action)

    def get_action_pretrain(self, state, expert_action):
        move_probs, stick_probs = self.net(state)
        m_move = torch.distributions.Categorical(move_probs)
        m_stick = torch.distributions.Categorical(stick_probs)
        move_action = m_move.sample()
        stick_action = m_stick.sample()
        loss = -torch.log(move_probs[expert_action] + 1e-8) - torch.log(stick_probs[2] + 1e-8)
        return (move_action.item(), stick_action.item()), loss

class Team:
    def __init__(self):
        # Index 0 is goalie, 1-5 are skaters
        self.agents = [Agent(is_goalie=True)] + [Agent(is_goalie=False) for _ in range(5)]
