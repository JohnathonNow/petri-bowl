const fs = require('fs');
let code = fs.readFileSync('hockey/web/train.js', 'utf8');

// I apparently failed to actually save the patch previously. I will do it correctly now.
const oldRL = `                // Store clone of state so we can re-evaluate it at end of episode
                episodeData[0][i].push({
                    state: state1, // we don't dispose this state yet!
                    actionMove: action1[0],
                    actionStick: action1[1]
                });

                let state2 = getState(env, 2, i);
                let { action: action2, logProbSum: lp2 } = team2.agents[i].getAction(state2);
                actions2.push(action2);

                episodeData[1][i].push({
                    state: state2,
                    actionMove: action2[0],
                    actionStick: action2[1]
                });
            }

            done = env.step(actions1, actions2);

            // Draw every step during RL training (or skip a few for speed, but instructions say identical)
            if (typeof drawGame === 'function' && env.history.length > 0) {
                drawGame(env.history[env.history.length - 1]);
                await tf.nextFrame();
            }
        }

        const reward1 = env.score[0] - env.score[1];
        const reward2 = env.score[1] - env.score[0];

        // Compute gradients and update
        for (let t_idx = 0; t_idx < 2; t_idx++) {
            const team = t_idx === 0 ? team1 : team2;
            const reward = t_idx === 0 ? reward1 : reward2;

            for (let a_idx = 0; a_idx < 6; a_idx++) {
                const agent = team.agents[a_idx];
                const data = episodeData[t_idx][a_idx];

                const lossFunction = () => {
                    let totalLoss = tf.scalar(0);

                    for (let step = 0; step < data.length; step++) {
                        const { state, actionMove, actionStick } = data[step];
                        const [moveProbs, stickProbs] = agent.net.forward(state);

                        const mProbArr = moveProbs.squeeze();
                        const sProbArr = stickProbs.squeeze();

                        const moveMask = tf.oneHot(tf.scalar(actionMove, 'int32'), CONSTANTS.NET_OUT_MOVE);
                        const stickMask = tf.oneHot(tf.scalar(actionStick, 'int32'), CONSTANTS.NET_OUT_STICK);

                        const moveProb = mProbArr.mul(moveMask).sum().add(1e-8);
                        const stickProb = sProbArr.mul(stickMask).sum().add(1e-8);

                        const logProb = tf.log(moveProb).add(tf.log(stickProb));

                        // loss = -lp * reward -> cumulative sum
                        // Note: totalLoss = totalLoss - lp * reward
                        totalLoss = totalLoss.sub(logProb.mul(reward));
                    }
                    return totalLoss;
                };

                const grads = agent.opt.computeGradients(lossFunction);
                agent.opt.applyGradients(grads.grads);

                // Dispose all states now that we are done with them
                for (let step = 0; step < data.length; step++) {
                    data[step].state.dispose();
                }
            }
        }`;

const newRL = `                // Extract array to prevent memory leaks from tensors
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
        }`;

code = code.replace(oldRL, newRL);

// Also fix pretrain yielding
code = code.replace(/if \(step % 5 === 0\) \{/g, 'if (step % 100 === 0) {');

fs.writeFileSync('hockey/web/train.js', code);
