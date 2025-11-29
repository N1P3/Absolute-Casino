"""
Monte‑Carlo Tree Search engine with neural‑network guidance for PokerKit.

Key responsibilities:
* Encode a PokerKit state dictionary into model tensors.
* Query the model for policy logits and a value estimate.
* Perform UCT‑guided tree search.
* Return the visit‑distribution (policy) and the root value estimate.
"""

import numpy as np
import torch
import torch.nn.functional as F
from typing import List, Dict, Tuple

from .mcts_node import MCTSNode
from train_rl_pokerkit import PokerKitEnvironment


class MCTSEngine:
    """
    AlphaZero‑style MCTS engine.
    """

    def __init__(self, model, device: torch.device, c_puct: float = 1.0, num_simulations: int = 100):
        self.model = model
        self.device = device
        self.c_puct = c_puct
        self.num_simulations = num_simulations
        self.env = PokerKitEnvironment()

    # --------------------------------------------------------------------- #
    # Helper methods
    # --------------------------------------------------------------------- #
    def _encode_state(self, state_dict: Dict) -> Dict:
        """Encode a state dict into model tensors (creates fresh tensors)."""
        static = torch.zeros(1, 18, device=self.device, dtype=torch.float32)
        action_seq = torch.zeros(1, 20, 10, device=self.device, dtype=torch.float32)

        # Encode hole cards (first 2 positions)
        hole_cards = state_dict.get('hole_cards', [])
        for i, card in enumerate(hole_cards[:2]):
            if len(card) >= 2:
                card_lower = card.lower()
                if card_lower in self.env.card_index_cache:
                    static[0, i] = float(self.env.card_index_cache[card_lower])
                else:
                    static[0, i] = 52.0
            else:
                static[0, i] = 52.0

        # Encode board cards (next 5 positions)
        board = state_dict.get('board', [])
        for i, card in enumerate(board[:5]):
            if len(card) >= 2:
                card_lower = card.lower()
                if card_lower in self.env.card_index_cache:
                    static[0, 2 + i] = float(self.env.card_index_cache[card_lower])
                else:
                    static[0, 2 + i] = 52.0
            else:
                static[0, 2 + i] = 52.0

        # Encode stacks (next 6 features, normalized)
        stacks = state_dict.get('stacks', [])
        for i, stack in enumerate(stacks[:6]):
            static[0, 7 + i] = stack / self.env.starting_stack

        # Encode pot (next 1 feature, normalized)
        static[0, 13] = state_dict.get('pot', 0) / self.env.starting_stack

        # Encode street (last 4 features, one‑hot)
        street = state_dict.get('street', 0)
        if street < 4:
            static[0, 14 + street] = 1.0

        # Encode action sequence (last 20 actions)
        actions = state_dict.get('actions', [])
        for i, action in enumerate(actions[-20:]):
            player_idx = action.get('player', 0)
            action_type = action.get('type', 0)
            amount = action.get('amount', 0)

            if player_idx < 6:
                action_seq[0, i, player_idx] = 1.0
            if action_type < 3:
                action_seq[0, i, 6 + action_type] = 1.0

            current_pot = state_dict.get('pot', 1)
            action_seq[0, i, 9] = amount / max(current_pot, 1)

        return {'static_state': static, 'action_sequence': action_seq}

    def _policy_value(self, state_dict: Dict):
        """Query the neural network for a policy distribution and a value estimate."""
        batch = self._encode_state(state_dict)
        with torch.no_grad():
            action_logits, value_pred = self.model(batch)
        logits = action_logits.squeeze(0).cpu()
        policy = F.softmax(logits, dim=0).cpu().numpy()
        value = float(value_pred.squeeze().item())
        return policy, value

    # --------------------------------------------------------------------- #
    # Core MCTS operations
    # --------------------------------------------------------------------- #
    def _select(self, node: MCTSNode) -> MCTSNode:
        """Select a leaf node using UCT."""
        while node.is_expanded() and not node.state.get("done", False):
            best_child = None
            best_score = -float("inf")
            for child in node.children.values():
                score = child.uct_score(node.visit_count, self.c_puct)
                if score > best_score:
                    best_score = score
                    best_child = child
            if best_child is None:
                raise RuntimeError("MCTS selection failed: no child found")
            node = best_child
        return node

    def _replay_actions(self, actions: List[Dict]) -> PokerKitEnvironment:
        """Replay a list of actions on a fresh environment."""
        env = PokerKitEnvironment()
        env.reset()
        for act in actions:
            a = act["type"]
            raise_amount = None
            if a == 2:
                pot = env.state.total_pot_amount
                raise_amount = act["amount"] / max(pot, 1)
            env.step(a, raise_amount)
        return env

    def _expand(self, node: MCTSNode) -> float:
        """Expand a leaf node and return its value."""
        # Determine valid actions
        valid_actions = node.state.get("valid_actions")
        # If the state does not contain a valid_actions list (e.g., during replay), compute it.
        # An empty list is a valid value indicating no actions are possible.
        if valid_actions is None:
            env_tmp = self._replay_actions(node.state.get("actions", []))
            valid_actions = env_tmp.get_valid_actions()
        # Get policy and value from network
        policy, value = self._policy_value(node.state)
        # Mask invalid actions
        mask = np.zeros_like(policy)
        mask[valid_actions] = 1.0
        masked_policy = policy * mask
        if masked_policy.sum() > 0:
            masked_policy = masked_policy / masked_policy.sum()
        else:
            masked_policy = np.ones_like(policy) / len(policy)
        # Create child nodes
        for action in valid_actions:
            env = self._replay_actions(node.state.get("actions", []))
            child_state, _, _, _ = env.step(action, raise_amount=None)
            child_node = MCTSNode(
                state=child_state,
                parent=node,
                action=action,
                prior_prob=masked_policy[action],
            )
            node.children[action] = child_node
        return value

    def _simulate(self, node: MCTSNode) -> float:
        """Perform a rollout (here using the value head)."""
        if node.state.get("done", False):
            _, value = self._policy_value(node.state)
            return value
        _, value = self._policy_value(node.state)
        return value

    def _backpropagate(self, node: MCTSNode, value: float) -> None:
        """Back‑propagate the value up the tree."""
        while node is not None:
            node.visit_count += 1
            node.value_sum += value
            value = -value
            node = node.parent  # type: ignore

    # --------------------------------------------------------------------- #
    # Public API
    # --------------------------------------------------------------------- #
    def search(self, root_state: Dict) -> Tuple[np.ndarray, float]:
        """Run MCTS from the given root state."""
        root = MCTSNode(state=root_state)
        self._expand(root)
        for _ in range(self.num_simulations):
            leaf = self._select(root)
            if not leaf.is_expanded() and not leaf.state.get("done", False):
                leaf_value = self._expand(leaf)
            else:
                leaf_value = self._simulate(leaf)
            self._backpropagate(leaf, leaf_value)

        visit_counts = np.zeros(3, dtype=np.float32)
        for action, child in root.children.items():
            visit_counts[action] = child.visit_count

        policy = visit_counts / visit_counts.sum() if visit_counts.sum() > 0 else np.ones(3, dtype=np.float32) / 3.0
        value = root.value()
        return policy, value