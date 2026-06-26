import argparse
import threading
import torch
import torch.optim as optim
from env.football_env import FootballEnv
from agents.agent import Team, get_state
from agents.models import PlayerNet, CoachNet
from web.server import run_server, set_global_env, set_global_teams, get_uploaded_model
from constants import CONSTANTS

def check_and_apply_uploaded_model(team1, team2):
    model_data = get_uploaded_model()
    if model_data:
        arch = model_data.get('architecture', {})
        weights = model_data.get('weights', {})
        if arch and weights:
            print("Applying newly uploaded model...", flush=True)
            # Update constants for new architecture
            for k, v in arch.items():
                if k in CONSTANTS:
                    CONSTANTS[k] = v

            for team in [team1, team2]:
                for agent in team.agents:
                    # Re-instantiate net with new architecture constants
                    agent.net = PlayerNet()
                    # Convert weight lists back to tensors
                    state_dict = agent.net.state_dict()
                    for key, val in weights.items():
                        if key in state_dict:
                            # Try to reshape to expected size
                            tensor_val = torch.tensor(val, dtype=torch.float32)
                            if tensor_val.shape == state_dict[key].shape:
                                state_dict[key] = tensor_val
                            else:
                                print(f"Shape mismatch for {key}: expected {state_dict[key].shape}, got {tensor_val.shape}")
                    agent.net.load_state_dict(state_dict)
                    agent.opt = optim.Adam(agent.net.parameters(), lr=CONSTANTS["LR"])

def train(use_web=False):
    team1 = Team()
    team2 = Team()

    coach1 = CoachNet()
    coach2 = CoachNet()
    coach1_opt = optim.Adam(coach1.parameters(), lr=CONSTANTS["LR"])
    coach2_opt = optim.Adam(coach2.parameters(), lr=CONSTANTS["LR"])

    set_global_teams([team1, team2])

    env = FootballEnv()
    env.use_web = use_web
    set_global_env(env)

    if use_web:
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        print("Web UI running at http://localhost:8083/", flush=True)

    epochs = CONSTANTS["TRAIN_EPOCHS"]
    for epoch in range(epochs):
        check_and_apply_uploaded_model(team1, team2)
        env.reset()
        done = False

        # Clear log probs for new episode
        for team in [team1, team2]:
            for agent in team.agents:
                agent.log_probs = []

        coach1_log_probs = []
        coach2_log_probs = []

        while not done:
            actions1 = []
            actions2 = []

            # Coaches call plays
            score_delta = env.score[0] - env.score[1]
            time_left = (CONSTANTS["MAX_STEPS"] - env.steps) / 60.0

            c1_state = torch.tensor([float(score_delta), float(time_left)], dtype=torch.float32)
            c2_state = torch.tensor([float(-score_delta), float(time_left)], dtype=torch.float32)

            c1_probs = coach1(c1_state)
            c2_probs = coach2(c2_state)

            m_c1 = torch.distributions.Categorical(c1_probs)
            m_c2 = torch.distributions.Categorical(c2_probs)

            play_call1 = m_c1.sample()
            play_call2 = m_c2.sample()

            coach1_log_probs.append(m_c1.log_prob(play_call1))
            coach2_log_probs.append(m_c2.log_prob(play_call2))

            for i in range(11):
                state1 = get_state(env, 1, i, play_call1.item())
                action1, log_prob1 = team1.agents[i].get_action(state1)
                actions1.append(action1)
                team1.agents[i].log_probs.append(log_prob1)

                state2 = get_state(env, 2, i, play_call2.item())
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

        # Update coaches
        c1_loss = 0
        for lp in coach1_log_probs:
            c1_loss = c1_loss - lp * reward1
        coach1_opt.zero_grad()
        if type(c1_loss) != int and c1_loss.requires_grad:
            c1_loss.backward()
            coach1_opt.step()

        c2_loss = 0
        for lp in coach2_log_probs:
            c2_loss = c2_loss - lp * reward2
        coach2_opt.zero_grad()
        if type(c2_loss) != int and c2_loss.requires_grad:
            c2_loss.backward()
            coach2_opt.step()

        print(f"Epoch {epoch}: Score {env.score[0]} - {env.score[1]}", flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train a hockey AI")
    parser.add_argument("--web", action="store_true", help="Start web UI to watch training")
    args = parser.parse_args()

    train(use_web=args.web)
