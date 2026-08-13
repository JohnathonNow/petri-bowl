class HockeyEnv {
    constructor() {
        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
        this.use_web = true;
        this.reset();
    }

    reset() {
        this.score = [0, 0]; // Team 1, Team 2
        this.steps = 0;
        this.history = [];
        this.is_replay = false;
        this.pending_replay = false;
        this.goal_scored_step = null;
        this.play_horn = false;

        this.last_touched_team = null;
        this.last_touched_x = null;
        this.icing_potential = false;

        this._reset_positions();
    }

    _reset_positions() {
        // deep copy initial positions
        this.p1_pos = CONSTANTS.P1_INIT_POS.map(pos => [...pos]);
        this.p2_pos = CONSTANTS.P2_INIT_POS.map(pos => [...pos]);

        this.p1_vel = Array.from({length: 6}, () => [0.0, 0.0]);
        this.p2_vel = Array.from({length: 6}, () => [0.0, 0.0]);

        this.p1_stick_angle = Array(6).fill(CONSTANTS.P1_INIT_STICK_ANGLE);
        this.p2_stick_angle = Array(6).fill(CONSTANTS.P2_INIT_STICK_ANGLE);

        this.puck_pos = [...CONSTANTS.PUCK_INIT_POS];
        this.puck_vel = [0.0, 0.0];

        this.ref_pos = CONSTANTS.REF_INIT_POS.map(pos => [...pos]);
        this.ref_vel = Array.from({length: CONSTANTS.NUM_REFS}, () => [0.0, 0.0]);
    }

    _apply_bounds(pos, vel) {
        const radius = CONSTANTS.BOUNDS_RADIUS;
        // rectangular bounds
        if (pos[0] < 0) {
            pos[0] = 0;
            vel[0] *= -1;
        } else if (pos[0] > this.width) {
            pos[0] = this.width;
            vel[0] *= -1;
        }

        if (pos[1] < 0) {
            pos[1] = 0;
            vel[1] *= -1;
        } else if (pos[1] > this.height) {
            pos[1] = this.height;
            vel[1] *= -1;
        }

        // rounded corners
        const corners = [
            [radius, radius],
            [this.width - radius, radius],
            [radius, this.height - radius],
            [this.width - radius, this.height - radius]
        ];

        for (const [cx, cy] of corners) {
            // check if pos is in the square corner region
            if ((pos[0] < radius && cx === radius) || (pos[0] > this.width - radius && cx === this.width - radius)) {
                if ((pos[1] < radius && cy === radius) || (pos[1] > this.height - radius && cy === this.height - radius)) {
                    const dx = pos[0] - cx;
                    const dy = pos[1] - cy;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > radius) {
                        // project back to the circle
                        pos[0] = cx + (dx / dist) * radius;
                        pos[1] = cy + (dy / dist) * radius;

                        // reflect velocity across normal
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const dot = vel[0] * nx + vel[1] * ny;
                        vel[0] -= 2 * dot * nx;
                        vel[1] -= 2 * dot * ny;
                    }
                }
            }
        }
    }

    _resolve_net_collision(pos, vel, is_puck) {
        // Team 1 net
        if (CONSTANTS.NET1_MIN_X <= pos[0] && pos[0] <= CONSTANTS.NET1_MAX_X && CONSTANTS.GOAL_Y_MIN <= pos[1] && pos[1] <= CONSTANTS.GOAL_Y_MAX) {
            const dx1 = pos[0] - CONSTANTS.NET1_MIN_X;
            const dx2 = CONSTANTS.NET1_MAX_X - pos[0];
            const dy1 = pos[1] - CONSTANTS.GOAL_Y_MIN;
            const dy2 = CONSTANTS.GOAL_Y_MAX - pos[1];
            const min_d = Math.min(dx1, dx2, dy1, dy2);

            if (min_d === dx1) {
                pos[0] = CONSTANTS.NET1_MIN_X;
                vel[0] = is_puck ? -vel[0] : 0.0;
            } else if (min_d === dx2) {
                pos[0] = CONSTANTS.NET1_MAX_X;
                vel[0] = is_puck ? -vel[0] : 0.0;
            } else if (min_d === dy1) {
                pos[1] = CONSTANTS.GOAL_Y_MIN;
                vel[1] = is_puck ? -vel[1] : 0.0;
            } else {
                pos[1] = CONSTANTS.GOAL_Y_MAX;
                vel[1] = is_puck ? -vel[1] : 0.0;
            }
        }
        // Team 2 net
        else if (CONSTANTS.NET2_MIN_X <= pos[0] && pos[0] <= CONSTANTS.NET2_MAX_X && CONSTANTS.GOAL_Y_MIN <= pos[1] && pos[1] <= CONSTANTS.GOAL_Y_MAX) {
            const dx1 = pos[0] - CONSTANTS.NET2_MIN_X;
            const dx2 = CONSTANTS.NET2_MAX_X - pos[0];
            const dy1 = pos[1] - CONSTANTS.GOAL_Y_MIN;
            const dy2 = CONSTANTS.GOAL_Y_MAX - pos[1];
            const min_d = Math.min(dx1, dx2, dy1, dy2);

            if (min_d === dx1) {
                pos[0] = CONSTANTS.NET2_MIN_X;
                vel[0] = is_puck ? -vel[0] : 0.0;
            } else if (min_d === dx2) {
                pos[0] = CONSTANTS.NET2_MAX_X;
                vel[0] = is_puck ? -vel[0] : 0.0;
            } else if (min_d === dy1) {
                pos[1] = CONSTANTS.GOAL_Y_MIN;
                vel[1] = is_puck ? -vel[1] : 0.0;
            } else {
                pos[1] = CONSTANTS.GOAL_Y_MAX;
                vel[1] = is_puck ? -vel[1] : 0.0;
            }
        }
    }

    _handle_icing(team_id) {
        this.icing_potential = false;
        this.last_touched_team = null;

        this._reset_positions();

        if (team_id === 1) {
            this.puck_pos = [15.0, 25.0];
        } else {
            this.puck_pos = [85.0, 25.0];
        }
    }

    step(actions1, actions2) {
        this.steps += 1;

        const check_dist = CONSTANTS.CHECKING_DIST;
        const check_speed_thresh = CONSTANTS.CHECKING_SPEED_THRESH;
        const check_effect = CONSTANTS.CHECKING_EFFECT;

        for (let i = 0; i < this.p1_pos.length; i++) {
            for (let j = 0; j < this.p2_pos.length; j++) {
                const dx = this.p1_pos[i][0] - this.p2_pos[j][0];
                const dy = this.p1_pos[i][1] - this.p2_pos[j][1];
                const dist = Math.hypot(dx, dy);

                if (dist < check_dist) {
                    const [v1x, v1y] = this.p1_vel[i];
                    const [v2x, v2y] = this.p2_vel[j];

                    const rel_vx = v1x - v2x;
                    const rel_vy = v1y - v2y;
                    const rel_speed = Math.hypot(rel_vx, rel_vy);

                    if (rel_speed > check_speed_thresh) {
                        this.p1_vel[i][0] *= (1.0 - check_effect);
                        this.p1_vel[i][1] *= (1.0 - check_effect);
                        this.p2_vel[j][0] *= (1.0 - check_effect);
                        this.p2_vel[j][1] *= (1.0 - check_effect);
                    }
                }
            }
        }

        if (this.use_web) {
            const state_snapshot = {
                step: this.steps,
                p1_pos: this.p1_pos.map(pos => [...pos]),
                p2_pos: this.p2_pos.map(pos => [...pos]),
                p1_stick_angle: [...this.p1_stick_angle],
                p2_stick_angle: [...this.p2_stick_angle],
                puck_pos: [...this.puck_pos],
                score: [...this.score],
                ref_pos: this.ref_pos.map(pos => [...pos])
            };
            this.history.push(state_snapshot);
            if (this.history.length > 200) {
                this.history.shift();
            }
        }

        const speed = CONSTANTS.SPEED;
        const rot_speed = CONSTANTS.ROT_SPEED;

        // move p1
        for (let i = 0; i < this.p1_pos.length; i++) {
            const [move_action, stick_action] = actions1[i];
            if (move_action === 0) this.p1_vel[i][1] -= speed;
            else if (move_action === 1) this.p1_vel[i][1] += speed;
            else if (move_action === 2) this.p1_vel[i][0] -= speed;
            else if (move_action === 3) this.p1_vel[i][0] += speed;

            if (stick_action === 0) this.p1_stick_angle[i] -= rot_speed;
            else if (stick_action === 1) this.p1_stick_angle[i] += rot_speed;

            this.p1_vel[i][0] *= CONSTANTS.FRICTION;
            this.p1_vel[i][1] *= CONSTANTS.FRICTION;

            this.p1_pos[i][0] += this.p1_vel[i][0];
            this.p1_pos[i][1] += this.p1_vel[i][1];
            this._apply_bounds(this.p1_pos[i], this.p1_vel[i]);
            this._resolve_net_collision(this.p1_pos[i], this.p1_vel[i], false);
        }

        // move ref
        const ref_speed = CONSTANTS.REF_SPEED;
        for (let i = 0; i < this.ref_pos.length; i++) {
            const rx = this.ref_pos[i][0];
            const ry = this.ref_pos[i][1];
            const px = this.puck_pos[0];
            const py = this.puck_pos[1];

            const dx = px - rx;
            const dy = py - ry;
            const dist = Math.hypot(dx, dy);

            let target_x = px;
            let target_y = py;

            if (dist < CONSTANTS.REF_AVOID_DIST) {
                target_x = rx - dx;
                target_y = ry - dy;
            } else if (dist > CONSTANTS.REF_AVOID_DIST * 2) {
                target_x = px;
                target_y = py;
            } else {
                target_x = rx;
                target_y = ry;
            }

            const tdx = target_x - rx;
            const tdy = target_y - ry;
            const tdist = Math.hypot(tdx, tdy);

            if (tdist > 0) {
                this.ref_vel[i][0] += (tdx / tdist) * ref_speed;
                this.ref_vel[i][1] += (tdy / tdist) * ref_speed;
            }

            this.ref_vel[i][0] *= CONSTANTS.FRICTION;
            this.ref_vel[i][1] *= CONSTANTS.FRICTION;

            this.ref_pos[i][0] += this.ref_vel[i][0];
            this.ref_pos[i][1] += this.ref_vel[i][1];

            this._apply_bounds(this.ref_pos[i], this.ref_vel[i]);
            this._resolve_net_collision(this.ref_pos[i], this.ref_vel[i], false);
        }

        // move p2
        for (let i = 0; i < this.p2_pos.length; i++) {
            const [move_action, stick_action] = actions2[i];
            if (move_action === 0) this.p2_vel[i][1] -= speed;
            else if (move_action === 1) this.p2_vel[i][1] += speed;
            else if (move_action === 2) this.p2_vel[i][0] -= speed;
            else if (move_action === 3) this.p2_vel[i][0] += speed;

            if (stick_action === 0) this.p2_stick_angle[i] -= rot_speed;
            else if (stick_action === 1) this.p2_stick_angle[i] += rot_speed;

            this.p2_vel[i][0] *= CONSTANTS.FRICTION;
            this.p2_vel[i][1] *= CONSTANTS.FRICTION;

            this.p2_pos[i][0] += this.p2_vel[i][0];
            this.p2_pos[i][1] += this.p2_vel[i][1];
            this._apply_bounds(this.p2_pos[i], this.p2_vel[i]);
            this._resolve_net_collision(this.p2_pos[i], this.p2_vel[i], false);
        }

        // puck physics
        this.puck_vel[0] *= CONSTANTS.PUCK_FRICTION;
        this.puck_vel[1] *= CONSTANTS.PUCK_FRICTION;

        this.puck_pos[0] += this.puck_vel[0];
        this.puck_pos[1] += this.puck_vel[1];
        this._apply_bounds(this.puck_pos, this.puck_vel);

        if (!this.pending_replay) {
            let scored_goal = false;
            // Goal check
            if (CONSTANTS.GOAL_Y_MIN <= this.puck_pos[1] && this.puck_pos[1] <= CONSTANTS.GOAL_Y_MAX) {
                if (this.puck_pos[0] < CONSTANTS.GOAL_X_1) {
                    this.score[1] += 1;
                    scored_goal = true;
                } else if (this.puck_pos[0] > CONSTANTS.GOAL_X_2) {
                    this.score[0] += 1;
                    scored_goal = true;
                }
            }

            if (scored_goal) {
                if (this.use_web) {
                    this.pending_replay = true;
                    this.play_horn = true;
                    this.goal_scored_step = this.steps;
                } else {
                    this._reset_positions();
                }
            } else {
                this._resolve_net_collision(this.puck_pos, this.puck_vel, true);
            }
        } else {
            this._resolve_net_collision(this.puck_pos, this.puck_vel, true);

            if (this.steps >= this.goal_scored_step + CONSTANTS.REPLAY_DELAY) {
                this.is_replay = true;
                this.play_horn = false;
                const actual_score = [...this.score];

                let replay_history = this.history.filter(s => s.step <= this.goal_scored_step + CONSTANTS.REPLAY_PAST_STEPS);
                if (replay_history.length > CONSTANTS.REPLAY_MAX_STEPS) {
                    replay_history = replay_history.slice(-CONSTANTS.REPLAY_MAX_STEPS);
                }

                // In JS, we cannot sleep blocking the thread.
                // However, since this is called synchronously during training step,
                // we will skip the explicit visual replay loop in the step function.
                // The training step should just instantly reset for RL speed.
                // The frontend handles drawing what's in state anyway.
                // Replay logic is skipped for synchronous RL training loop, just resetting immediately.

                this.is_replay = false;
                this.play_horn = false;
                this.pending_replay = false;
                this.score = actual_score;
                this.history = [];
                this._reset_positions();
            }
        }

        // Goalie constraints
        // Team 1 goalie
        this.p1_pos[0][0] = Math.max(CONSTANTS.G1_MIN_X, Math.min(CONSTANTS.G1_MAX_X, this.p1_pos[0][0]));
        this.p1_pos[0][1] = Math.max(CONSTANTS.G1_MIN_Y, Math.min(CONSTANTS.G1_MAX_Y, this.p1_pos[0][1]));

        // Team 2 goalie
        this.p2_pos[0][0] = Math.max(CONSTANTS.G2_MIN_X, Math.min(CONSTANTS.G2_MAX_X, this.p2_pos[0][0]));
        this.p2_pos[0][1] = Math.max(CONSTANTS.G2_MIN_Y, Math.min(CONSTANTS.G2_MAX_Y, this.p2_pos[0][1]));

        // Player-stick-puck collisions
        const check_stick_collision = (p_pos, p_angle, team_id) => {
            const stick_length = CONSTANTS.STICK_LENGTH;
            const puck_x = this.puck_pos[0];
            const puck_y = this.puck_pos[1];
            const px = p_pos[0];
            const py = p_pos[1];

            const ex = px + Math.cos(p_angle) * stick_length;
            const ey = py + Math.sin(p_angle) * stick_length;

            const sx = ex - px;
            const sy = ey - py;
            const px_v = puck_x - px;
            const py_v = puck_y - py;

            const stick_len_sq = sx*sx + sy*sy;
            let t = 0;
            if (stick_len_sq !== 0) {
                t = Math.max(0, Math.min(1, (px_v * sx + py_v * sy) / stick_len_sq));
            }

            const cx = px + t * sx;
            const cy = py + t * sy;

            const dx = puck_x - cx;
            const dy = puck_y - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < CONSTANTS.PUCK_RADIUS_THRESH) {
                this.last_touched_team = team_id;
                this.last_touched_x = this.puck_pos[0];
                this.icing_potential = true;

                if (dist === 0) {
                    this.puck_vel[0] += (Math.random() < 0.5 ? -1.0 : 1.0);
                    this.puck_vel[1] += (Math.random() < 0.5 ? -1.0 : 1.0);
                } else {
                    this.puck_vel[0] += (dx/dist) * 2.0;
                    this.puck_vel[1] += (dy/dist) * 2.0;
                }
            }
        };

        for (let i = 0; i < this.p1_pos.length; i++) {
            check_stick_collision(this.p1_pos[i], this.p1_stick_angle[i], 1);
        }
        for (let i = 0; i < this.p2_pos.length; i++) {
            check_stick_collision(this.p2_pos[i], this.p2_stick_angle[i], 2);
        }

        // Icing checks
        const goal_x1 = CONSTANTS.GOAL_X_1;
        const goal_x2 = CONSTANTS.GOAL_X_2;
        const center_line = this.width / 2.0;

        if (this.icing_potential && this.last_touched_team !== null) {
            if (this.last_touched_team === 1 && this.last_touched_x <= center_line) {
                if (this.puck_pos[0] >= goal_x2) {
                    this._handle_icing(1);
                }
            } else if (this.last_touched_team === 2 && this.last_touched_x >= center_line) {
                if (this.puck_pos[0] <= goal_x1) {
                    this._handle_icing(2);
                }
            }
        }

        const done = this.steps >= CONSTANTS.MAX_STEPS;
        return done;
    }
}
