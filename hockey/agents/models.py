import torch
import torch.nn as nn
from constants import CONSTANTS

class PlayerNet(nn.Module):
    def __init__(self):
        super(PlayerNet, self).__init__()
        # Input: 4 (my pos, puck pos) + 2 (my stick dir) + 11*2 (other pos) + 11*2 (other stick dirs) = 50
        self.fc1 = nn.Linear(CONSTANTS["NET_INPUT"], CONSTANTS["NET_HIDDEN1"])
        self.fc2 = nn.Linear(CONSTANTS["NET_HIDDEN1"], CONSTANTS["NET_HIDDEN2"])
        self.fc_move = nn.Linear(CONSTANTS["NET_HIDDEN2"], CONSTANTS["NET_OUT_MOVE"])
        self.fc_stick = nn.Linear(CONSTANTS["NET_HIDDEN2"], CONSTANTS["NET_OUT_STICK"])

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = self.fc2(x)
        move_logits = self.fc_move(x)
        stick_logits = self.fc_stick(x)
        return torch.softmax(move_logits, dim=-1), torch.softmax(stick_logits, dim=-1)
