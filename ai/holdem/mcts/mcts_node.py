"""
MCTSNode – a node in the Monte‑Carlo Tree Search tree for PokerKit.
Each node stores:
- state dict
- parent reference
- children dict mapping action index → child node
- prior probability (from the neural‑network policy)
- visit count N(s)
- accumulated value W(s)
- the action that led to this node (for back‑propagation)
"""

import numpy as np
from typing import Dict, Optional


class MCTSNode:
    """
    Node used by the Monte‑Carlo Tree Search engine.
    Stores the environment state, parent link, children, prior probability,
    visit count and accumulated value.
    """

    def __init__(
        self,
        state: Dict,
        parent: Optional["MCTSNode"] = None,
        action: Optional[int] = None,
        prior_prob: float = 0.0,
    ):
        """
        Parameters
        ----------
        state : dict
            The PokerKit state dictionary for this node.
        parent : MCTSNode, optional
            Parent node in the tree.
        action : int, optional
            Action taken from the parent to reach this node.
        prior_prob : float, optional
            Prior probability from the neural‑network policy.
        """
        self.state = state
        self.parent = parent
        self.action = action
        self.prior = prior_prob
        self.children: Dict[int, MCTSNode] = {}
        self.visit_count: int = 0
        self.value_sum: float = 0.0  # accumulated value (W(s))

    def is_expanded(self) -> bool:
        """Return True if the node has any child nodes."""
        return len(self.children) > 0

    def expand(self, action_priors: Dict[int, float]) -> None:
        """
        Create child nodes for each legal action.
        ``action_priors`` maps action index → prior probability.
        """
        for action, prob in action_priors.items():
            if action not in self.children:
                # Child state will be filled later by the engine.
                self.children[action] = MCTSNode(
                    state={},  # placeholder, will be replaced during expansion
                    parent=self,
                    action=action,
                    prior_prob=prob,
                )

    def uct_score(self, parent_visits: int, c_puct: float) -> float:
        """
        Compute the UCT (Upper Confidence bound for Trees) score.
        """
        q = self.value_sum / self.visit_count if self.visit_count > 0 else 0.0
        u = c_puct * self.prior * (np.sqrt(parent_visits) / (1 + self.visit_count))
        return q + u

    def value(self) -> float:
        """Return the average value (Q) for this node."""
        return self.value_sum / self.visit_count if self.visit_count > 0 else 0.0