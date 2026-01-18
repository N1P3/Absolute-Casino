"""Debug środowiska V3."""
from makao_env_v3 import MakaoEnvV3
from sb3_contrib import MaskablePPO
from heuristic_agent import HeuristicAgent

env = MakaoEnvV3()
model = MaskablePPO.load('makao_v3_sparse_256.zip')
heur = HeuristicAgent()

obs, _ = env.reset()
print(f'Start: P0={len(env.hands[0])}, P1={len(env.hands[1])}, deck={len(env.deck)}')
print(f'P0 hand: {env.hands[0]}')
print(f'P1 hand: {env.hands[1]}')
print(f'Table: {env.game.table_card}')
print()

# Ręcznie sprawdźmy co heurystyka widzi
env.current_player = 1
mask_p1 = env.action_masks()
valid_p1 = [i for i, v in enumerate(mask_p1) if v]
print(f'P1 valid actions: {valid_p1}')
for a in valid_p1:
    if a < 52:
        print(f'  {a}: Single {env.card_map[a]}')
    elif a == 91:
        print(f'  {a}: Draw')
    elif a == 92:
        print(f'  {a}: Skip')

heur_action, desc = heur.select_action(env)
print(f'\nHeurystyka wybiera: action={heur_action}, {desc}')

for step in range(50):
    mask = env.action_masks()
    action, _ = model.predict(obs, action_masks=mask, deterministic=True)
    action = int(action)
    
    p0_before = len(env.hands[0])
    p1_before = len(env.hands[1])
    deck_before = len(env.deck)
    pending_draw = env.game.pending_draw_count
    
    obs, reward, done, truncated, info = env.step(action)
    
    p0_after = len(env.hands[0])
    p1_after = len(env.hands[1])
    deck_after = len(env.deck)
    
    action_desc = "?" 
    if action < 52:
        action_desc = f"Single {env.card_map[action]}"
    elif action < 65:
        action_desc = f"2x rank {env.ranks[action-52]}"
    elif action < 78:
        action_desc = f"3x rank {env.ranks[action-65]}"
    elif action < 91:
        action_desc = f"4x rank {env.ranks[action-78]}"
    elif action == 91:
        action_desc = f"Draw"
    else:
        action_desc = f"Skip"
    
    print(f'Step {step+1}: {action_desc:15s} | P0: {p0_before:2d}->{p0_after:2d}, P1: {p1_before:2d}->{p1_after:2d}, deck: {deck_before:2d}->{deck_after:2d}, pending_draw_before={pending_draw}')
    
    if done or truncated:
        print(f'Done: {done}, Truncated: {truncated}, reward={reward}')
        break
