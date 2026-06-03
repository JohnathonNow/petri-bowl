import argparse
import threading
from env.hockey_env import HockeyEnv
from agents.agent import Team, get_state, get_expert_action
from web.server import run_server, set_global_env
from constants import CONSTANTS

pretrain = True

def train(use_web=False):
    global pretrain
    team1 = Team()
    team2 = Team()

    env = HockeyEnv()
    set_global_env(env)

    if use_web:
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        print("Web UI running at http://localhost:8080/", flush=True)

    print("Starting pre-training phase...", flush=True)
    for _ in range(CONSTANTS["PRETRAIN_EPOCHS"]):
        env.reset()
        for _ in range(CONSTANTS["PRETRAIN_STEPS"]): # max steps per pre-train epoch
            actions1 = []
            actions2 = []

            losses = []

            for i in range(6):
                # Team 1
                state1 = get_state(env, 1, i)
                if i == 0:
                    target_x, target_y = CONSTANTS["EXPERT_TARGET_X_1_G"], env.puck_pos[1]
                else:
                    if i in [1, 2]:
                        target_x, target_y = min(env.puck_pos[0], CONSTANTS["EXPERT_TARGET_X_1_D_MAX"]), env.puck_pos[1]
                    else:
                        target_x, target_y = env.puck_pos[0], env.puck_pos[1]

                exp_a1 = get_expert_action(env.p1_pos[i][0], env.p1_pos[i][1], target_x, target_y)
                action1, loss1 = team1.agents[i].get_action_pretrain(state1, exp_a1)

                if i in [1, 2] and env.p1_pos[i][0] > CONSTANTS["EXPERT_TARGET_X_1_PENALTY_THRESH"]:
                    loss1 = loss1 * CONSTANTS["EXPERT_PENALTY_MULT"]
                actions1.append(action1)
                losses.append((team1.agents[i], loss1))

                # Team 2
                state2 = get_state(env, 2, i)
                if i == 0:
                    target_x, target_y = CONSTANTS["EXPERT_TARGET_X_2_G"], env.puck_pos[1]
                else:
                    if i in [1, 2]:
                        target_x, target_y = max(env.puck_pos[0], CONSTANTS["EXPERT_TARGET_X_2_D_MIN"]), env.puck_pos[1]
                    else:
                        target_x, target_y = env.puck_pos[0], env.puck_pos[1]

                exp_a2 = get_expert_action(env.p2_pos[i][0], env.p2_pos[i][1], target_x, target_y)
                action2, loss2 = team2.agents[i].get_action_pretrain(state2, exp_a2)

                if i in [1, 2] and env.p2_pos[i][0] < CONSTANTS["EXPERT_TARGET_X_2_PENALTY_THRESH"]:
                    loss2 = loss2 * CONSTANTS["EXPERT_PENALTY_MULT"]
                actions2.append(action2)
                losses.append((team2.agents[i], loss2))

            for agent, loss in losses:
                agent.opt.zero_grad()
                if type(loss) != int and loss.requires_grad:
                    loss.backward()
                    agent.opt.step()

            done = env.step(actions1, actions2)
            if done:
                break
    print("Pre-training phase complete.", flush=True)
    pretrain = False

    epochs = CONSTANTS["TRAIN_EPOCHS"]
    for epoch in range(epochs):
        env.reset()
        done = False

        # Clear log probs for new episode
        for team in [team1, team2]:
            for agent in team.agents:
                agent.log_probs = []

        while not done:
            actions1 = []
            actions2 = []

            for i in range(6):
                state1 = get_state(env, 1, i)
                action1, log_prob1 = team1.agents[i].get_action(state1)
                actions1.append(action1)
                team1.agents[i].log_probs.append(log_prob1)

                state2 = get_state(env, 2, i)
                action2, log_prob2 = team2.agents[i].get_action(state2)
                actions2.append(action2)
                team2.agents[i].log_probs.append(log_prob2)

            done = env.step(actions1, actions2)

        reward1 = float(env.score[0] - env.score[1])
        reward2 = float(env.score[1] - env.score[0])

        for team, reward in [(team1, reward1), (team2, reward2)]:
            for agent in team.agents:
                loss = 0
                for lp in agent.log_probs:
                    loss = loss - lp * reward

                agent.opt.zero_grad()
                if type(loss) != int and loss.requires_grad:
                    loss.backward()
                    agent.opt.step()

        print(f"Epoch {epoch}: Score {env.score[0]} - {env.score[1]}", flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train a hockey AI")
    parser.add_argument("--web", action="store_true", help="Start web UI to watch training")
    args = parser.parse_args()

    train(use_web=args.web)
