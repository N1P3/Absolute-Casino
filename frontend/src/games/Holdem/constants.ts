export const SEAT_POSITIONS_3D: Record<number, [number, number, number]> = {
  0: [0, 0, 3], // Hero
  1: [4.2, 0, 2.2], // Right Bottom
  2: [4.2, 0, -2.2], // Right Top
  3: [0, 0, -3], // Top Center
  4: [-4.2, 0, -2.2], // Left Top
  5: [-4.2, 0, 2.2], // Left Bottom
};

export const WS_URL = "ws://localhost:8081/ws/holdem";
export const ACTION_TIMEOUT_MS = 20_000;
export const NEXT_HAND_DELAY_MS = 3_000;

export const GAME_STAGES = {
  PREFLOP: "PREFLOP",
  FLOP: "FLOP",
  TURN: "TURN",
  RIVER: "RIVER",
  SHOWDOWN: "SHOWDOWN",
};
