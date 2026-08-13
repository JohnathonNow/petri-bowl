import math
import random
import time
import copy
from constants import CONSTANTS

class HockeyEnv:
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

        self.last_touched_team = None
        self.last_touched_x = None
        self.icing_potential = False

        self._reset_positions()

    def step(self, actions1, actions2):
        self.steps += 1

        # checking mechanics
        check_dist = CONSTANTS["CHECKING_DIST"]
        check_speed_thresh = CONSTANTS["CHECKING_SPEED_THRESH"]
        check_effect = CONSTANTS["CHECKING_EFFECT"]

        for i, p1 in enumerate(self.p1_pos):
            for j, p2 in enumerate(self.p2_pos):
                dx = p1[0] - p2[0]
                dy = p1[1] - p2[1]
                dist = math.hypot(dx, dy)

                if dist < check_dist:
                    v1x, v1y = self.p1_vel[i]
                    v2x, v2y = self.p2_vel[j]

                    rel_vx = v1x - v2x
                    rel_vy = v1y - v2y
                    rel_speed = math.hypot(rel_vx, rel_vy)

                    if rel_speed > check_speed_thresh:
                        # Transfer some momentum / reduce velocities
                        self.p1_vel[i][0] *= (1.0 - check_effect)
                        self.p1_vel[i][1] *= (1.0 - check_effect)
                        self.p2_vel[j][0] *= (1.0 - check_effect)
                        self.p2_vel[j][1] *= (1.0 - check_effect)


        if getattr(self, 'use_web', False):
            state_snapshot = {
                "step": self.steps,
                "p1_pos": copy.deepcopy(self.p1_pos),
                "p2_pos": copy.deepcopy(self.p2_pos),
                "p1_stick_angle": copy.deepcopy(self.p1_stick_angle),
                "p2_stick_angle": copy.deepcopy(self.p2_stick_angle),
                "puck_pos": copy.deepcopy(self.puck_pos),
                "score": copy.deepcopy(self.score),
                "ref_pos": copy.deepcopy(self.ref_pos)
            }
            self.history.append(state_snapshot)
            if len(self.history) > 200:
                self.history.pop(0)

        # actions: 0=up, 1=down, 2=left, 3=right, 4=stay
        speed = CONSTANTS["SPEED"]
        rot_speed = CONSTANTS["ROT_SPEED"]

        # move p1
        for i in range(len(self.p1_pos)):
            move_action, stick_action = actions1[i]
            if move_action == 0: self.p1_vel[i][1] -= speed
            elif move_action == 1: self.p1_vel[i][1] += speed
            elif move_action == 2: self.p1_vel[i][0] -= speed
            elif move_action == 3: self.p1_vel[i][0] += speed

            if stick_action == 0: self.p1_stick_angle[i] -= rot_speed
            elif stick_action == 1: self.p1_stick_angle[i] += rot_speed

            self.p1_vel[i][0] *= CONSTANTS["FRICTION"]
            self.p1_vel[i][1] *= CONSTANTS["FRICTION"]

            self.p1_pos[i][0] += self.p1_vel[i][0]
            self.p1_pos[i][1] += self.p1_vel[i][1]
            self._apply_bounds(self.p1_pos[i], self.p1_vel[i])
            self._resolve_net_collision(self.p1_pos[i], self.p1_vel[i], False)

        # move ref
        ref_speed = CONSTANTS["REF_SPEED"]
        for i in range(len(self.ref_pos)):
            rx, ry = self.ref_pos[i]
            px, py = self.puck_pos

            # Vector towards puck
            dx = px - rx
            dy = py - ry
            dist_to_puck = math.hypot(dx, dy)

            if dist_to_puck > 0:
                nx = dx / dist_to_puck
                ny = dy / dist_to_puck
            else:
                nx, ny = 0, 0

            # If too close to puck, back away
            if dist_to_puck < CONSTANTS["REF_AVOID_DIST"]:
                nx = -nx
                ny = -ny

            # Avoid players
            avoid_x, avoid_y = 0.0, 0.0
            for players in [self.p1_pos, self.p2_pos]:
                for player in players:
                    pdx = rx - player[0]
                    pdy = ry - player[1]
                    pdist = math.hypot(pdx, pdy)
                    if pdist < CONSTANTS["REF_AVOID_DIST"] and pdist > 0:
                        avoid_x += pdx / pdist
                        avoid_y += pdy / pdist

            vx = nx * ref_speed + avoid_x * ref_speed
            vy = ny * ref_speed + avoid_y * ref_speed

            v_mag = math.hypot(vx, vy)
            if v_mag > ref_speed:
                vx = (vx / v_mag) * ref_speed
                vy = (vy / v_mag) * ref_speed

            self.ref_vel[i][0] = vx
            self.ref_vel[i][1] = vy

            self.ref_pos[i][0] += self.ref_vel[i][0]
            self.ref_pos[i][1] += self.ref_vel[i][1]
            self._apply_bounds(self.ref_pos[i], self.ref_vel[i])

        # move p2
        for i in range(len(self.p2_pos)):
            move_action, stick_action = actions2[i]
            if move_action == 0: self.p2_vel[i][1] -= speed
            elif move_action == 1: self.p2_vel[i][1] += speed
            elif move_action == 2: self.p2_vel[i][0] -= speed
            elif move_action == 3: self.p2_vel[i][0] += speed

            if stick_action == 0: self.p2_stick_angle[i] -= rot_speed
            elif stick_action == 1: self.p2_stick_angle[i] += rot_speed

            self.p2_vel[i][0] *= CONSTANTS["FRICTION"]
            self.p2_vel[i][1] *= CONSTANTS["FRICTION"]

            self.p2_pos[i][0] += self.p2_vel[i][0]
            self.p2_pos[i][1] += self.p2_vel[i][1]
            self._apply_bounds(self.p2_pos[i], self.p2_vel[i])
            self._resolve_net_collision(self.p2_pos[i], self.p2_vel[i], False)

        # Puck physics (simplified)
        old_puck_x = self.puck_pos[0]
        self.puck_pos[0] += self.puck_vel[0]
        self.puck_pos[1] += self.puck_vel[1]

        # friction
        self.puck_vel[0] *= CONSTANTS["PUCK_FRICTION"]
        self.puck_vel[1] *= CONSTANTS["PUCK_FRICTION"]

        self._apply_bounds(self.puck_pos, self.puck_vel)

        # Goals
        goal_y_min = CONSTANTS["GOAL_Y_MIN"]
        goal_y_max = CONSTANTS["GOAL_Y_MAX"]

        if not getattr(self, 'pending_replay', False):
            scored_goal = False
            if old_puck_x > CONSTANTS["GOAL_X_1"] and self.puck_pos[0] <= CONSTANTS["GOAL_X_1"]:
                if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                    self.score[1] += 1
                    scored_goal = True
            elif old_puck_x < CONSTANTS["GOAL_X_2"] and self.puck_pos[0] >= CONSTANTS["GOAL_X_2"]:
                if goal_y_min <= self.puck_pos[1] <= goal_y_max:
                    self.score[0] += 1
                    scored_goal = True

            if scored_goal:
                if getattr(self, 'use_web', False):
                    self.pending_replay = True
                    self.play_horn = True
                    self.goal_scored_step = self.steps
                else:
                    self._reset_positions()
            else:
                self._resolve_net_collision(self.puck_pos, self.puck_vel, True)
        else:
            self._resolve_net_collision(self.puck_pos, self.puck_vel, True)

            if self.steps >= self.goal_scored_step + CONSTANTS["REPLAY_DELAY"]:
                self.is_replay = True
                self.play_horn = False
                actual_score = copy.deepcopy(self.score)

                # Replay sequence: last 100 steps from history up to goal_scored_step + 10
                # Filter history for items where step <= goal_scored_step + 10
                replay_history = [s for s in self.history if s["step"] <= self.goal_scored_step + CONSTANTS["REPLAY_PAST_STEPS"]]
                # Then take the last 100 of those
                if len(replay_history) > CONSTANTS["REPLAY_MAX_STEPS"]:
                    replay_history = replay_history[-CONSTANTS["REPLAY_MAX_STEPS"]:]

                for state_snapshot in replay_history:
                    self.p1_pos = state_snapshot["p1_pos"]
                    self.p2_pos = state_snapshot["p2_pos"]
                    self.p1_stick_angle = state_snapshot["p1_stick_angle"]
                    self.p2_stick_angle = state_snapshot["p2_stick_angle"]
                    self.puck_pos = state_snapshot["puck_pos"]
                    self.score = state_snapshot["score"]
                    self.ref_pos = state_snapshot.get("ref_pos", self.ref_pos)
                    time.sleep(0.05)

                self.is_replay = False
                self.play_horn = False
                self.pending_replay = False
                self.score = actual_score
                self.history = []
                self._reset_positions()

        # Goalie constraints
        # Team 1 goalie
        self.p1_pos[0][0] = max(CONSTANTS["G1_MIN_X"], min(CONSTANTS["G1_MAX_X"], self.p1_pos[0][0]))
        self.p1_pos[0][1] = max(CONSTANTS["G1_MIN_Y"], min(CONSTANTS["G1_MAX_Y"], self.p1_pos[0][1]))

        # Team 2 goalie
        self.p2_pos[0][0] = max(CONSTANTS["G2_MIN_X"], min(CONSTANTS["G2_MAX_X"], self.p2_pos[0][0]))
        self.p2_pos[0][1] = max(CONSTANTS["G2_MIN_Y"], min(CONSTANTS["G2_MAX_Y"], self.p2_pos[0][1]))

        # Player-stick-puck collisions
        def check_stick_collision(p_pos, p_angle, team_id):
            # Stick modeled as line segment starting at p_pos
            stick_length = CONSTANTS["STICK_LENGTH"]
            puck_x, puck_y = self.puck_pos
            px, py = p_pos

            # Stick endpoint
            ex = px + math.cos(p_angle) * stick_length
            ey = py + math.sin(p_angle) * stick_length

            # Vector from start to end
            sx, sy = ex - px, ey - py
            # Vector from start to puck
            px_v, py_v = puck_x - px, puck_y - py

            # Project puck onto stick line
            stick_len_sq = sx**2 + sy**2
            if stick_len_sq == 0:
                t = 0
            else:
                t = max(0, min(1, (px_v * sx + py_v * sy) / stick_len_sq))

            # Closest point on stick
            cx = px + t * sx
            cy = py + t * sy

            # Distance from puck to closest point
            dx = puck_x - cx
            dy = puck_y - cy
            dist = (dx**2 + dy**2)**0.5

            # Threshold for collision
            if dist < CONSTANTS["PUCK_RADIUS_THRESH"]:
                self.last_touched_team = team_id
                self.last_touched_x = self.puck_pos[0]
                self.icing_potential = True

                if dist == 0:
                    self.puck_vel[0] += random.choice([-1.0, 1.0])
                    self.puck_vel[1] += random.choice([-1.0, 1.0])
                else:
                    self.puck_vel[0] += (dx/dist) * 2.0
                    self.puck_vel[1] += (dy/dist) * 2.0

        for p, angle in zip(self.p1_pos, self.p1_stick_angle):
            check_stick_collision(p, angle, 1)
        for p, angle in zip(self.p2_pos, self.p2_stick_angle):
            check_stick_collision(p, angle, 2)

        # Icing checks
        goal_x1 = CONSTANTS["GOAL_X_1"]
        goal_x2 = CONSTANTS["GOAL_X_2"]
        center_line = self.width / 2.0

        if self.icing_potential and self.last_touched_team is not None:
            # Icing team 1: shot from < center, passes goal_x2
            if self.last_touched_team == 1 and self.last_touched_x <= center_line:
                if self.puck_pos[0] >= goal_x2:
                    # Icing!
                    self._handle_icing(1)

            # Icing team 2: shot from > center, passes goal_x1
            elif self.last_touched_team == 2 and self.last_touched_x >= center_line:
                if self.puck_pos[0] <= goal_x1:
                    # Icing!
                    self._handle_icing(2)


        done = self.steps >= CONSTANTS["MAX_STEPS"]
        return done

    def _handle_icing(self, team_id):
        self.icing_potential = False
        self.last_touched_team = None

        # Reset positions but move puck to defensive zone of icing team
        self._reset_positions()

        if team_id == 1:
            # Team 1 iced the puck, faceoff in Team 1 zone (left side)
            self.puck_pos = [15.0, 25.0]
        else:
            # Team 2 iced the puck, faceoff in Team 2 zone (right side)
            self.puck_pos = [85.0, 25.0]

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

    def _apply_bounds(self, pos, vel):
        radius = CONSTANTS["BOUNDS_RADIUS"]
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
        self.p1_pos = [list(pos) for pos in CONSTANTS["P1_INIT_POS"]]
        self.p2_pos = [list(pos) for pos in CONSTANTS["P2_INIT_POS"]]

        self.p1_vel = [[0.0, 0.0] for _ in range(6)]
        self.p2_vel = [[0.0, 0.0] for _ in range(6)]

        self.p1_stick_angle = [CONSTANTS["P1_INIT_STICK_ANGLE"] for _ in range(6)]
        self.p2_stick_angle = [CONSTANTS["P2_INIT_STICK_ANGLE"] for _ in range(6)]

        self.puck_pos = list(CONSTANTS["PUCK_INIT_POS"])
        self.puck_vel = [0.0, 0.0]

        self.ref_pos = [list(pos) for pos in CONSTANTS["REF_INIT_POS"]]
        self.ref_vel = [[0.0, 0.0] for _ in range(CONSTANTS["NUM_REFS"])]
