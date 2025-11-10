import { CardKey } from "../shared";

export type MakaoResponse = {
  type: string;
  playerHand?: CardKey[];
  opponentHandCount?: number;
  tableCard?: CardKey;
  currentSuit?: string | null;
  requiredNumber?: string | null;
  pendingDrawCount?: number;
  drawType?: string | null;
  pendingSkipTurns?: number;
  currentPlayerId?: number;
  currentPlayerName?: string;
  gameOver?: boolean;
  result?: "WIN" | "LOSE" | null;
  moneyWon?: number;
  message?: string;
  players?: Array<{
    userId: number;
    userName: string;
    handCount: number;
    isCurrent: boolean;
  }>;

export type ErrorResponse = {
  Type: string;
  Message: string;
};

export type State = "idle" | "waiting" | "dealing" | "playing" | "end";

export type GameState = {
  state: State;
  playerHand: CardKey[];
  opponentHandCount: number;
  tableCard: CardKey | null;
  currentSuit: string | null;
  requiredNumber: string | null;
  pendingDrawCount: number;
  drawType: string | null;
  pendingSkipTurns: number;
  currentPlayerId: number | null;
  isMyTurn: boolean;
  result: string | null;
  moneyWon: number;
};
