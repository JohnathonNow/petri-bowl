import math

CONSTANTS = {
    "WIDTH": 256.0,
    "HEIGHT": 128.0,
    "MAX_STEPS": 3600,

    # Football stats
    "SPEED": 1.0,
    "SHAKE": 0.05,
    "CATCH": 0.95,
    "THROW": 0.975,
    "BLOCK": 0.1,
    "INT": 0.01,
    "WEIGHT": 75.0,
    "ARM": 30.0,

    # Init pos (11 players each)
    "P1_INIT_POS": [
        [20.0, 64.0], [30.0, 40.0], [30.0, 88.0],
        [40.0, 20.0], [40.0, 108.0], [50.0, 50.0],
        [50.0, 78.0], [60.0, 64.0], [70.0, 30.0],
        [70.0, 98.0], [80.0, 64.0]
    ],
    "P2_INIT_POS": [
        [236.0, 64.0], [226.0, 40.0], [226.0, 88.0],
        [216.0, 20.0], [216.0, 108.0], [206.0, 50.0],
        [206.0, 78.0], [196.0, 64.0], [186.0, 30.0],
        [186.0, 98.0], [176.0, 64.0]
    ],
    "BALL_INIT_POS": [128.0, 64.0],

    # Network
    "NET_INPUT": 25,
    "NET_HIDDEN1": 8,
    "NET_HIDDEN2": 8,
    "NET_OUT_DIR": 5,
    "NET_OUT_SPEED": 9,
    "NET_OUT_PASS": 12,

    # Training
    "LR": 0.01,
    "TRAIN_EPOCHS": 100,

    # Canvas
    "CANVAS_WIDTH": 800,
    "CANVAS_HEIGHT": 400,

    # Replay
    "REPLAY_MAX_STEPS": 100,
    "REPLAY_PAST_STEPS": 50,
    "REPLAY_DELAY": 100,
}
