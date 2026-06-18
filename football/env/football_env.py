import math
import random
import time
import copy
from constants import CONSTANTS

class FootballEnv:
    def __init__(self):
        self.width = CONSTANTS["WIDTH"]
        self.height = CONSTANTS["HEIGHT"]
        self.reset()

    def reset(self):
        self.score = [0, 0] # Team 1, Team 2
        self.steps = 0
        self.history = []
        self.is_replay = False
        self.pending_replay = False
        self.goal_scored_step = None
        self.play_horn = False
        self._reset_positions()

    def step(self, actions1, actions2):
        self.steps += 1

        if getattr(self, 'use_web', False):
            state_snapshot = {
                "step": self.steps,
                "p1_pos": copy.deepcopy(self.p1_pos),
                "p2_pos": copy.deepcopy(self.p2_pos),
                "ball_pos": copy.deepcopy(self.ball_pos),
                "score": copy.deepcopy(self.score)
            }
            self.history.append(state_snapshot)
            if len(self.history) > 200:
                self.history.pop(0)

        # actions: dir (0=up, 1=down, 2=left, 3=right, 4=stay), speed_frac (0-8), pass (0-11, 0=no pass)
        base_speed = CONSTANTS["SPEED"]

        def move_player(pos, move_action, speed_action, is_carrier):
            actual_speed = (speed_action / 8.0) * base_speed

            if is_carrier:
                # Apply dragging penalty
                carrier_team = 1 if self.ball_carrier[0] == 1 else 2
                defenders = self.p2_pos if carrier_team == 1 else self.p1_pos
                for d_pos in defenders:
                    dist = ((pos[0] - d_pos[0])**2 + (pos[1] - d_pos[1])**2)**0.5
                    if dist <= 2.0:
                        # Grabbed
                        actual_speed *= (CONSTANTS["WEIGHT"] / (CONSTANTS["WEIGHT"] + 200.0))

                        # Check shake
                        if random.random() > CONSTANTS["SHAKE"]:
                            actual_speed = 0.0 # Tackled

            if move_action == 0: pos[1] -= actual_speed
            elif move_action == 1: pos[1] += actual_speed
            elif move_action == 2: pos[0] -= actual_speed
            elif move_action == 3: pos[0] += actual_speed
            self._apply_bounds(pos)

        # Move p1
        for i in range(len(self.p1_pos)):
            d_act, s_act, p_act = actions1[i]
            is_carrier = (self.ball_carrier == (1, i))
            move_player(self.p1_pos[i], d_act, s_act, is_carrier)

            if is_carrier and p_act > 0 and self.can_throw:
                target_idx = p_act - 1
                if target_idx != i and target_idx < len(self.p1_pos):
                    # Passing logic
                    target_pos = self.p1_pos[target_idx]

                    if target_pos[0] > self.p1_pos[i][0]:
                        self.can_throw = False # Forward pass

                    dist = ((target_pos[0] - self.p1_pos[i][0])**2 + (target_pos[1] - self.p1_pos[i][1])**2)**0.5

                    # Throw odds
                    throw_success = True
                    if random.random() > CONSTANTS["THROW"]:
                        throw_success = False
                    if dist > CONSTANTS["ARM"]:
                        # Normal distribution penalty past ARM
                        if random.random() < 0.5: # Simple penalty
                            throw_success = False

                    if throw_success:
                        # Check path for INT or BLOCK
                        interrupted = False
                        for d_pos in self.p2_pos:
                            d_dist = ((d_pos[0] - self.p1_pos[i][0])**2 + (d_pos[1] - self.p1_pos[i][1])**2)**0.5
                            if d_dist < dist:
                                # roughly inline
                                if random.random() < CONSTANTS["INT"]:
                                    self.ball_carrier = (2, self.p2_pos.index(d_pos))
                                    self.can_throw = True
                                    interrupted = True
                                    break
                                elif random.random() < CONSTANTS["BLOCK"]:
                                    self.ball_carrier = None
                                    interrupted = True
                                    break

                        if not interrupted:
                            if random.random() < CONSTANTS["CATCH"]:
                                self.ball_carrier = (1, target_idx)
                            else:
                                self.ball_carrier = None # Incomplete
                    else:
                        self.ball_carrier = None # Incomplete

        # Move p2
        for i in range(len(self.p2_pos)):
            d_act, s_act, p_act = actions2[i]
            is_carrier = (self.ball_carrier == (2, i))
            move_player(self.p2_pos[i], d_act, s_act, is_carrier)

            if is_carrier and p_act > 0 and self.can_throw:
                target_idx = p_act - 1
                if target_idx != i and target_idx < len(self.p2_pos):
                    # Passing logic
                    target_pos = self.p2_pos[target_idx]

                    if target_pos[0] < self.p2_pos[i][0]:
                        self.can_throw = False # Forward pass

                    dist = ((target_pos[0] - self.p2_pos[i][0])**2 + (target_pos[1] - self.p2_pos[i][1])**2)**0.5

                    # Throw odds
                    throw_success = True
                    if random.random() > CONSTANTS["THROW"]:
                        throw_success = False
                    if dist > CONSTANTS["ARM"]:
                        if random.random() < 0.5:
                            throw_success = False

                    if throw_success:
                        # Check path for INT or BLOCK
                        interrupted = False
                        for d_pos in self.p1_pos:
                            d_dist = ((d_pos[0] - self.p2_pos[i][0])**2 + (d_pos[1] - self.p2_pos[i][1])**2)**0.5
                            if d_dist < dist:
                                if random.random() < CONSTANTS["INT"]:
                                    self.ball_carrier = (1, self.p1_pos.index(d_pos))
                                    self.can_throw = True
                                    interrupted = True
                                    break
                                elif random.random() < CONSTANTS["BLOCK"]:
                                    self.ball_carrier = None
                                    interrupted = True
                                    break

                        if not interrupted:
                            if random.random() < CONSTANTS["CATCH"]:
                                self.ball_carrier = (2, target_idx)
                            else:
                                self.ball_carrier = None
                    else:
                        self.ball_carrier = None

        # Pick up loose ball
        if self.ball_carrier is None:
            for i, p in enumerate(self.p1_pos):
                if ((p[0] - self.ball_pos[0])**2 + (p[1] - self.ball_pos[1])**2)**0.5 <= 2.0:
                    self.ball_carrier = (1, i)
                    break
            if self.ball_carrier is None:
                for i, p in enumerate(self.p2_pos):
                    if ((p[0] - self.ball_pos[0])**2 + (p[1] - self.ball_pos[1])**2)**0.5 <= 2.0:
                        self.ball_carrier = (2, i)
                        break
        else:
            # Sync ball pos to carrier
            c_team, c_idx = self.ball_carrier
            if c_team == 1:
                self.ball_pos = list(self.p1_pos[c_idx])
            else:
                self.ball_pos = list(self.p2_pos[c_idx])

        # Touchdowns
        self.play_horn = False
        if self.ball_carrier is not None:
            if self.ball_pos[0] >= CONSTANTS["WIDTH"]:
                self.score[0] += 7
                self._reset_positions()
                if getattr(self, 'use_web', False):
                    self.play_horn = True
            elif self.ball_pos[0] <= 0:
                self.score[1] += 7
                self._reset_positions()
                if getattr(self, 'use_web', False):
                    self.play_horn = True

        done = self.steps >= CONSTANTS["MAX_STEPS"]
        return done

    def _resolve_net_collision(self, pos, vel, is_puck):
        # Team 1 net
        if CONSTANTS["NET1_MIN_X"] <= pos[0] <= CONSTANTS["NET1_MAX_X"] and CONSTANTS["GOAL_Y_MIN"] <= pos[1] <= CONSTANTS["GOAL_Y_MAX"]:
            dx1 = pos[0] - CONSTANTS["NET1_MIN_X"]
            dx2 = CONSTANTS["NET1_MAX_X"] - pos[0]
            dy1 = pos[1] - CONSTANTS["GOAL_Y_MIN"]
            dy2 = CONSTANTS["GOAL_Y_MAX"] - pos[1]
            min_d = min(dx1, dx2, dy1, dy2)

            if min_d == dx1:
                pos[0] = CONSTANTS["NET1_MIN_X"]
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dx2:
                pos[0] = CONSTANTS["NET1_MAX_X"]
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dy1:
                pos[1] = CONSTANTS["GOAL_Y_MIN"]
                vel[1] = -vel[1] if is_puck else 0.0
            else:
                pos[1] = CONSTANTS["GOAL_Y_MAX"]
                vel[1] = -vel[1] if is_puck else 0.0

        # Team 2 net
        elif CONSTANTS["NET2_MIN_X"] <= pos[0] <= CONSTANTS["NET2_MAX_X"] and CONSTANTS["GOAL_Y_MIN"] <= pos[1] <= CONSTANTS["GOAL_Y_MAX"]:
            dx1 = pos[0] - CONSTANTS["NET2_MIN_X"]
            dx2 = CONSTANTS["NET2_MAX_X"] - pos[0]
            dy1 = pos[1] - CONSTANTS["GOAL_Y_MIN"]
            dy2 = CONSTANTS["GOAL_Y_MAX"] - pos[1]
            min_d = min(dx1, dx2, dy1, dy2)

            if min_d == dx1:
                pos[0] = CONSTANTS["NET2_MIN_X"]
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dx2:
                pos[0] = CONSTANTS["NET2_MAX_X"]
                vel[0] = -vel[0] if is_puck else 0.0
            elif min_d == dy1:
                pos[1] = CONSTANTS["GOAL_Y_MIN"]
                vel[1] = -vel[1] if is_puck else 0.0
            else:
                pos[1] = CONSTANTS["GOAL_Y_MAX"]
                vel[1] = -vel[1] if is_puck else 0.0

    def _apply_bounds(self, pos):
        if pos[0] < 0:
            pos[0] = 0
        elif pos[0] > self.width:
            pos[0] = self.width

        if pos[1] < 0:
            pos[1] = 0
        elif pos[1] > self.height:
            pos[1] = self.height

    def _reset_positions(self):
        self.p1_pos = [list(pos) for pos in CONSTANTS["P1_INIT_POS"]]
        self.p2_pos = [list(pos) for pos in CONSTANTS["P2_INIT_POS"]]

        self.ball_pos = list(CONSTANTS["BALL_INIT_POS"])
        self.ball_carrier = None
        self.can_throw = True
