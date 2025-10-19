import { CardKey } from "../shared";

export type BaccaratResponse = {
  is_over: boolean;
  player_cards: CardKey[];
  dealer_cards: CardKey[];
  money_won: number;
  players_result: Result;
};

export enum Result {
  WIN = "WIN",
  LOST = "LOST",
}

export type Choice = "PUNTO" | "BANCO" | "TIE";
export type HandPositions = "player" | "banker";
export type State = "idle" | "dealing" | "dealt" | "end";

export type GameState = {
  state: State;
  playerCount: string;
  bankerCount: string;
  result: string | null;
};
