class PlayerNet {
    constructor() {
        this.inputLayer = tf.layers.dense({units: CONSTANTS.NET_HIDDEN1, activation: 'relu', inputShape: [CONSTANTS.NET_INPUT]});
        this.hiddenLayer = tf.layers.dense({units: CONSTANTS.NET_HIDDEN2});
        this.moveLayer = tf.layers.dense({units: CONSTANTS.NET_OUT_MOVE});
        this.stickLayer = tf.layers.dense({units: CONSTANTS.NET_OUT_STICK});

        // Define model via Functional API to have multiple outputs
        const input = tf.input({shape: [CONSTANTS.NET_INPUT]});
        let x = this.inputLayer.apply(input);
        x = this.hiddenLayer.apply(x);
        const moveLogits = this.moveLayer.apply(x);
        const stickLogits = this.stickLayer.apply(x);

        this.model = tf.model({inputs: input, outputs: [moveLogits, stickLogits]});
    }

    forward(x) {
        return tf.tidy(() => {
            const [moveLogits, stickLogits] = this.model.predict(x);
            return [tf.softmax(moveLogits, -1), tf.softmax(stickLogits, -1)];
        });
    }

    getWeights() {
        return this.model.getWeights();
    }

    setWeights(weights) {
        this.model.setWeights(weights);
    }
}

// Helper to sample from categorical distribution and compute log prob
function sampleCategorical(probs) {
    return tf.tidy(() => {
        // probs is shape [1, num_classes]
        const c = tf.multinomial(probs, 1);
        const action = c.dataSync()[0];

        // log_prob = log(probs[action])
        const prob = probs.flatten().arraySync()[action];
        const logProb = Math.log(prob + 1e-8);
        return { action, logProb };
    });
}

function getState(env, team, player_idx) {
    let my_pos, my_angle, other_players, other_angles;

    if (team === 1) {
        my_pos = env.p1_pos[player_idx];
        my_angle = env.p1_stick_angle[player_idx];
        other_players = env.p1_pos.filter((_, i) => i !== player_idx).concat(env.p2_pos);
        other_angles = env.p1_stick_angle.filter((_, i) => i !== player_idx).concat(env.p2_stick_angle);
    } else {
        my_pos = env.p2_pos[player_idx];
        my_angle = env.p2_stick_angle[player_idx];
        other_players = env.p2_pos.filter((_, i) => i !== player_idx).concat(env.p1_pos);
        other_angles = env.p2_stick_angle.filter((_, i) => i !== player_idx).concat(env.p1_stick_angle);
    }

    let state = [
        my_pos[0] / CONSTANTS.WIDTH,
        my_pos[1] / CONSTANTS.HEIGHT,
        env.puck_pos[0] / CONSTANTS.WIDTH,
        env.puck_pos[1] / CONSTANTS.HEIGHT,
        Math.cos(my_angle),
        Math.sin(my_angle)
    ];

    for (let i = 0; i < other_players.length; i++) {
        const p = other_players[i];
        const a = other_angles[i];
        state.push(p[0] / CONSTANTS.WIDTH);
        state.push(p[1] / CONSTANTS.HEIGHT);
        state.push(Math.cos(a));
        state.push(Math.sin(a));
    }

    return tf.tensor2d([state], [1, state.length]); // Shape [1, 50]
}

function getExpertAction(px, py, tx, ty) {
    const dx = tx - px;
    const dy = ty - py;
    if (Math.abs(dx) < CONSTANTS.EXPERT_ACTION_TOL && Math.abs(dy) < CONSTANTS.EXPERT_ACTION_TOL) {
        return 4; // stay
    }
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
            return 3; // right
        } else {
            return 2; // left
        }
    } else {
        if (dy > 0) {
            return 1; // down
        } else {
            return 0; // up
        }
    }
}

class Agent {
    constructor(is_goalie = false) {
        this.net = new PlayerNet();
        this.opt = tf.train.adam(CONSTANTS.LR);
        this.log_probs = [];
        this.is_goalie = is_goalie;
    }

    getAction(state) {
        return tf.tidy(() => {
            const [moveProbs, stickProbs] = this.net.forward(state);
            const moveSample = sampleCategorical(moveProbs);
            const stickSample = sampleCategorical(stickProbs);

            const action = [moveSample.action, stickSample.action];
            const logProbSum = moveSample.logProb + stickSample.logProb;

            return { action, logProbSum };
        });
    }

    // Unlike Python where we return a loss tensor, in JS we will compute
    // gradients directly inside a tf.tidy with the optimizer since we don't return PyTorch computation graphs.
    // So this function takes state, expert_action, and applies the step immediately.
    trainPretrainStep(state, expertAction, penaltyMult = 1.0) {
        return tf.tidy(() => {
            const lossFunction = () => {
                const [moveProbs, stickProbs] = this.net.forward(state);

                // PyTorch: loss = -torch.log(move_probs[expert_action] + 1e-8) - torch.log(stick_probs[2] + 1e-8)
                const moveProbArr = moveProbs.squeeze();
                const stickProbArr = stickProbs.squeeze();

                // Slicing to get specific action probabilities
                // In TFJS doing dynamic slicing inside a differentiable function is tricky,
                // so we can construct a one-hot mask and do a dot product or sum.
                const moveMask = tf.oneHot(tf.scalar(expertAction, 'int32'), CONSTANTS.NET_OUT_MOVE);
                const stickMask = tf.oneHot(tf.scalar(2, 'int32'), CONSTANTS.NET_OUT_STICK); // Expert stick action is always 2 in pretrain? Yes, Python uses index 2.

                const moveProbSelected = moveProbArr.mul(moveMask).sum();
                const stickProbSelected = stickProbArr.mul(stickMask).sum();

                let loss = tf.log(moveProbSelected.add(1e-8)).mul(-1)
                        .sub(tf.log(stickProbSelected.add(1e-8)));

                if (penaltyMult !== 1.0) {
                    loss = loss.mul(penaltyMult);
                }

                return loss;
            };

            const grads = this.opt.computeGradients(lossFunction);
            this.opt.applyGradients(grads.grads);

            // To return actions to environment for taking a step, we sample after or before.
            // In Python, they sample actions BEFORE backwards. We'll just do a separate forward pass to sample action for the env.
            const [mProbs, sProbs] = this.net.forward(state);
            const mAction = sampleCategorical(mProbs).action;
            const sAction = sampleCategorical(sProbs).action;

            return [mAction, sAction];
        });
    }
}

class Team {
    constructor() {
        this.agents = [new Agent(true)];
        for (let i = 0; i < 5; i++) {
            this.agents.push(new Agent(false));
        }
    }
}
