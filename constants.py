import math

CONSTANTS = {
    "WIDTH": 100.0,
    "HEIGHT": 50.0,
    "GOAL_Y_MIN": 21.0,
    "GOAL_Y_MAX": 29.0,
    "GOAL_X_1": 10.0,
    "GOAL_X_2": 90.0,
    "MAX_STEPS": 20000,
    "SPEED": 0.2,
    "ROT_SPEED": 0.2,
    "FRICTION": 0.90,
    "PUCK_FRICTION": 0.95,
    "BOUNDS_RADIUS": 15.0,
    "STICK_LENGTH": 2.0,
    "PUCK_RADIUS_THRESH": 2.0,

    # Init pos
    "P1_INIT_POS": [
        [12.0, 25.0],
        [25.0, 10.0], [25.0, 25.0], [25.0, 40.0],
        [40.0, 15.0], [40.0, 35.0]
    ],
    "P2_INIT_POS": [
        [88.0, 25.0],
        [75.0, 10.0], [75.0, 25.0], [75.0, 40.0],
        [60.0, 15.0], [60.0, 35.0]
    ],
    "P1_INIT_STICK_ANGLE": 0.0,
    "P2_INIT_STICK_ANGLE": math.pi,
    "PUCK_INIT_POS": [50.0, 25.0],

    # Refs
    "NUM_REFS": 2,
    "REF_SPEED": 0.15,
    "REF_INIT_POS": [
        [50.0, 5.0],
        [50.0, 45.0]
    ],
    "REF_AVOID_DIST": 5.0,

    # Checking
    "CHECKING_DIST": 2.0,
    "CHECKING_SPEED_THRESH": 0.2,
    "CHECKING_EFFECT": 0.2,

    # Goalie constraints
    "G1_MIN_X": 10.0,
    "G1_MAX_X": 20.0,
    "G1_MIN_Y": 10.0,
    "G1_MAX_Y": 40.0,
    "G2_MIN_X": 80.0,
    "G2_MAX_X": 90.0,
    "G2_MIN_Y": 10.0,
    "G2_MAX_Y": 40.0,

    # Net collision constraints
    "NET1_MIN_X": 5.0,
    "NET1_MAX_X": 10.0,
    "NET2_MIN_X": 90.0,
    "NET2_MAX_X": 95.0,

    # Network
    "NET_INPUT": 50,
    "NET_HIDDEN1": 8,
    "NET_HIDDEN2": 8,
    "NET_OUT_MOVE": 5,
    "NET_OUT_STICK": 3,

    # Training
    "LR": 0.01,
    "PRETRAIN_EPOCHS": 1000,
    "PRETRAIN_STEPS": 400,
    "TRAIN_EPOCHS": 100,

    # Expert targets
    "EXPERT_TARGET_X_1_G": 12.0,
    "EXPERT_TARGET_X_1_D_MAX": 45.0,
    "EXPERT_TARGET_X_1_PENALTY_THRESH": 50.0,

    "EXPERT_TARGET_X_2_G": 88.0,
    "EXPERT_TARGET_X_2_D_MIN": 55.0,
    "EXPERT_TARGET_X_2_PENALTY_THRESH": 50.0,

    "EXPERT_PENALTY_MULT": 5.0,
    "EXPERT_ACTION_TOL": 1.0,

    # Canvas
    "CANVAS_WIDTH": 800,
    "CANVAS_HEIGHT": 400,

    # Replay
    "REPLAY_MAX_STEPS": 100,
    "REPLAY_PAST_STEPS": 50,
    "REPLAY_DELAY": 100,
}
