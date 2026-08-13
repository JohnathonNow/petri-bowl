let env, team1, team2;
let pretrain = true;

// Replaces the check_and_apply_uploaded_model python functionality
// In JS, we handle uploads directly via the UI events, but we keep a dummy function
// here for structure similarity, and it will be populated if models are dropped in via UI later.
function checkAndApplyUploadedModel(t1, t2) {
    // Handled asynchronously by the UI listeners directly modifying agent models.
}

async function runPretrainPhase() {
    console.log("Starting pre-training phase...");

    // In JS we chunk the epochs to not freeze the browser completely.
    // However, to mimic 1000 epochs of 400 steps quickly, we might freeze a bit if we aren't careful.
    // We will do tf.nextFrame() periodically.

    for (let epoch = 0; epoch < CONSTANTS.PRETRAIN_EPOCHS; epoch++) {
        env.reset();

        for (let step = 0; step < CONSTANTS.PRETRAIN_STEPS; step++) {
            const actions1 = [];
            const actions2 = [];

            for (let i = 0; i < 6; i++) {
                // Team 1
                let state1 = getState(env, 1, i);
                let target_x, target_y;
                if (i === 0) {
                    target_x = CONSTANTS.EXPERT_TARGET_X_1_G;
                    target_y = env.puck_pos[1];
                } else {
                    if (i === 1 || i === 2) {
                        target_x = Math.min(env.puck_pos[0], CONSTANTS.EXPERT_TARGET_X_1_D_MAX);
                        target_y = env.puck_pos[1];
                    } else {
                        target_x = env.puck_pos[0];
                        target_y = env.puck_pos[1];
                    }
                }

                let exp_a1 = getExpertAction(env.p1_pos[i][0], env.p1_pos[i][1], target_x, target_y);
                let penalty1 = 1.0;
                if ((i === 1 || i === 2) && env.p1_pos[i][0] > CONSTANTS.EXPERT_TARGET_X_1_PENALTY_THRESH) {
                    penalty1 = CONSTANTS.EXPERT_PENALTY_MULT;
                }

                let action1 = team1.agents[i].trainPretrainStep(state1, exp_a1, penalty1);
                actions1.push(action1);
                state1.dispose();

                // Team 2
                let state2 = getState(env, 2, i);
                if (i === 0) {
                    target_x = CONSTANTS.EXPERT_TARGET_X_2_G;
                    target_y = env.puck_pos[1];
                } else {
                    if (i === 1 || i === 2) {
                        target_x = Math.max(env.puck_pos[0], CONSTANTS.EXPERT_TARGET_X_2_D_MIN);
                        target_y = env.puck_pos[1];
                    } else {
                        target_x = env.puck_pos[0];
                        target_y = env.puck_pos[1];
                    }
                }

                let exp_a2 = getExpertAction(env.p2_pos[i][0], env.p2_pos[i][1], target_x, target_y);
                let penalty2 = 1.0;
                if ((i === 1 || i === 2) && env.p2_pos[i][0] < CONSTANTS.EXPERT_TARGET_X_2_PENALTY_THRESH) {
                    penalty2 = CONSTANTS.EXPERT_PENALTY_MULT;
                }

                let action2 = team2.agents[i].trainPretrainStep(state2, exp_a2, penalty2);
                actions2.push(action2);
                state2.dispose();
            }

            const done = env.step(actions1, actions2);

            // Periodically draw so it doesn't just sit on a blank screen
            if (step % 50 === 0) {
                if (typeof drawGame === 'function') {
                    drawGame(env.history[env.history.length - 1]);
                }
                await tf.nextFrame();
            }

            if (done) {
                break;
            }
        }

        if (epoch % 10 === 0) {
            console.log(`Pre-train Epoch ${epoch} complete`);
        }
    }
    console.log("Pre-training phase complete.");
    pretrain = false;
}

async function runRLPhase() {
    console.log("Starting RL training phase...");

    // In order to perform REINFORCE in JS, we need to defer the gradient calculation
    // until the end of the episode.
    // So we need to compute the loss over all log_probs collected.
    // The easiest way is to re-compute them in a single tf.tidy block at the end,
    // or collect the states/actions and compute loss.
    // Let's modify the RL loop to store (state_tensor, action) and then compute loss at the end.
    // A state_tensor must be kept alive, so we can't dispose it immediately.

    for (let epoch = 0; epoch < CONSTANTS.TRAIN_EPOCHS; epoch++) {
        env.reset();
        let done = false;

        // Arrays to hold history for this episode
        const episodeData = Array.from({length: 2}, () => Array.from({length: 6}, () => []));

        while (!done) {
            const actions1 = [];
            const actions2 = [];

            for (let i = 0; i < 6; i++) {
                let state1 = getState(env, 1, i);
                let { action: action1, logProbSum: lp1 } = team1.agents[i].getAction(state1);
                actions1.push(action1);

                // Extract array to prevent memory leaks from tensors
                let state1Arr = state1.arraySync();
                episodeData[0][i].push({
                    stateArr: state1Arr,
                    actionMove: action1[0],
                    actionStick: action1[1]
                });
                state1.dispose();

                let state2 = getState(env, 2, i);
                let { action: action2, logProbSum: lp2 } = team2.agents[i].getAction(state2);
                actions2.push(action2);

                let state2Arr = state2.arraySync();
                episodeData[1][i].push({
                    stateArr: state2Arr,
                    actionMove: action2[0],
                    actionStick: action2[1]
                });
                state2.dispose();
            }

            done = env.step(actions1, actions2);

            // Periodically draw and yield so UI stays responsive, but not every frame to speed up RL
            if (env.steps % 25 === 0) {
                if (typeof drawGame === 'function' && env.history.length > 0) {
                    drawGame(env.history[env.history.length - 1]);
                }
                await tf.nextFrame();
            }
        }

        const reward1 = env.score[0] - env.score[1];
        const reward2 = env.score[1] - env.score[0];

        // Compute gradients and update using batched states to avoid OOM
        const BATCH_SIZE = 500;

        for (let t_idx = 0; t_idx < 2; t_idx++) {
            const team = t_idx === 0 ? team1 : team2;
            const reward = t_idx === 0 ? reward1 : reward2;

            for (let a_idx = 0; a_idx < 6; a_idx++) {
                const agent = team.agents[a_idx];
                const data = episodeData[t_idx][a_idx];

                for (let b = 0; b < data.length; b += BATCH_SIZE) {
                    const batchData = data.slice(b, b + BATCH_SIZE);

                    const lossFunction = () => {
                        let totalLoss = tf.scalar(0);

                        for (let step = 0; step < batchData.length; step++) {
                            const { stateArr, actionMove, actionStick } = batchData[step];
                            const stateTensor = tf.tensor2d(stateArr);
                            const [moveProbs, stickProbs] = agent.net.forward(stateTensor);

                            const mProbArr = moveProbs.squeeze();
                            const sProbArr = stickProbs.squeeze();

                            const moveMask = tf.oneHot(tf.scalar(actionMove, 'int32'), CONSTANTS.NET_OUT_MOVE);
                            const stickMask = tf.oneHot(tf.scalar(actionStick, 'int32'), CONSTANTS.NET_OUT_STICK);

                            const moveProb = mProbArr.mul(moveMask).sum().add(1e-8);
                            const stickProb = sProbArr.mul(stickMask).sum().add(1e-8);

                            const logProb = tf.log(moveProb).add(tf.log(stickProb));

                            totalLoss = totalLoss.sub(logProb.mul(reward));
                            stateTensor.dispose();
                        }
                        return totalLoss;
                    };

                    const grads = agent.opt.computeGradients(lossFunction);
                    agent.opt.applyGradients(grads.grads);
                    Object.values(grads.grads).forEach(t => t.dispose());
                    grads.value.dispose();
                }
            }
        }

        console.log(`Epoch ${epoch}: Score ${env.score[0]} - ${env.score[1]}`);
    }
}

async function train() {
    team1 = new Team();
    team2 = new Team();
    env = new HockeyEnv();

    // Bind drawGame slightly delayed to ensure elements load in HTML
    await new Promise(r => setTimeout(r, 100));

    await runPretrainPhase();
    await runRLPhase();
}
