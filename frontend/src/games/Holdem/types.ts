// types.ts

export interface HoldemPlayer {
    userId: number;
    seatPosition: number;
    stack: number;
    betThisStreet: number;
    folded: boolean;
    allIn: boolean;
    currentTurn: boolean;
    you: boolean;
}

export type HoldemMessageType = "GAME_STATE" | "ERROR";

export interface HoldemResponse {
    type: HoldemMessageType;
    tableId?: number;
    communityCards?: string[];
    pot?: number;
    currentBet?: number;
    street?: string | null;
    dealerSeat?: number | null;
    currentPlayerSeat?: number | null;
    players?: HoldemPlayer[];
    viewerHoleCards?: string[] | null;
    availableActions?: string[];
    result?: string | null;
    lastAction?: string | null;
    message?: string;
}

export interface ErrorResponse {
    type: "ERROR";
    message: string;
}

export type HoldemStatePhase = "idle" | "waiting" | "playing" | "end";

export interface HoldemGameState {
    state: HoldemStatePhase;
    playerHand: string[];
    communityCards: string[];
    pot: number;
    currentBet: number;
    gameStage: string;
    currentPlayerSeat: number | null;
    dealerSeat: number | null;
    isMyTurn: boolean;
    players: HoldemPlayer[];
    result: string | null;
    gameOver: boolean;
    availableActions: string[];
    lastAction: string | null;
}
