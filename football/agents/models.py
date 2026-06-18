import torch
import torch.nn as nn
from constants import CONSTANTS

class CoachNet(nn.Module):
    def __init__(self):
        super(CoachNet, self).__init__()
        # Input: 2 (Score delta, Game time)
        self.fc1 = nn.Linear(2, CONSTANTS["NET_HIDDEN1"])
        self.fc2 = nn.Linear(CONSTANTS["NET_HIDDEN1"], 10) # 10 play calls

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        play_logits = self.fc2(x)
        return torch.softmax(play_logits, dim=-1)

class PlayerNet(nn.Module):
    def __init__(self):
        super(PlayerNet, self).__init__()
        # Input: 1 (play call) + 22 (relative pos) + 2 (field pos) + 1 (can throw) = 26
        self.fc1 = nn.Linear(CONSTANTS["NET_INPUT"], CONSTANTS["NET_HIDDEN1"])
        self.fc2 = nn.Linear(CONSTANTS["NET_HIDDEN1"], CONSTANTS["NET_HIDDEN2"])
        self.fc_dir = nn.Linear(CONSTANTS["NET_HIDDEN2"], CONSTANTS["NET_OUT_DIR"])
        self.fc_speed = nn.Linear(CONSTANTS["NET_HIDDEN2"], CONSTANTS["NET_OUT_SPEED"])
        self.fc_pass = nn.Linear(CONSTANTS["NET_HIDDEN2"], CONSTANTS["NET_OUT_PASS"])

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = self.fc2(x)
        dir_logits = self.fc_dir(x)
        speed_logits = self.fc_speed(x)
        pass_logits = self.fc_pass(x)
        return torch.softmax(dir_logits, dim=-1), torch.softmax(speed_logits, dim=-1), torch.softmax(pass_logits, dim=-1)
