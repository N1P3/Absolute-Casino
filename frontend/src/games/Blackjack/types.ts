import { CardKey } from "../shared";

export type BlackjackResponse = {
  player_cards: CardKey[];
  player_split_cards: CardKey[];
  dealer_cards: CardKey[];
  card_hit: CardKey | null;
  result: Result;
  result_split: Result | null;
  money_won: number;
  money_won_split: number | null;
  doublable: boolean | null;
  splitable: boolean | null;
};

export type ErrorResponse = {
  Type: "ERROR";
  Message: string;
};

export enum Result {
  WIN = "WIN",
  LOST = "LOST",
  DRAW = "DRAW",
  UNRESOLVED = "UNRESOLVED",
  BLACKJACK = "BLACKJACK",
}
export type HandPositions = "player" | "player_split_1" | "player_split_2" | "dealer";
export type State = "idle" | "dealing" | "dealt" | "dealingHit" | "end";
export type GameState = {
  state: State;
  playerCount: string;
  playerSplitCount: string;
  handValue: number;
  handSplitValue: number;
  currentHand: HandPositions | null;
  dealerCount: string;
  result: Result | null;
  result_split: Result | null;
  splitable: boolean;
  doubleable: boolean;
  isSplit: boolean;
};
