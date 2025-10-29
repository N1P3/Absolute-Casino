import { CardKey } from "../shared";

export type MakaoResponse = {
  is_over: boolean;
  player_hand: CardKey[];
  computer_hand_count: number;
  table_card: CardKey;
  current_suit?: string;
  money_won: number;
  result: Result;
};

export enum Result {
  WIN = "WIN",
  LOST = "LOST",
  DRAW = "DRAW",
}

export type State = "idle" | "dealing" | "playing" | "computer_turn" | "end";

export type GameState = {
  state: State;
  playerHand: CardKey[];
  computerHandCount: number;
  tableCard: CardKey | null;
  currentSuit: string | null;
  result: string | null;
};
