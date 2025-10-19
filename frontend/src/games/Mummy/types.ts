import { Bonus, Line, SlotGameResponse } from "@/engine/types";

export type FreeSpinsBonus = {
  type: "FREE_SPINS";
  freeSpinsLeft: number;
} & Bonus;

export type FreeSpinsMummyBonus = {
  type: "FREE_SPINS_MUMMY";
  freeSpinsLeft: number;
  mummyLine: Line;
} & Bonus;

export type MummyBonus = FreeSpinsBonus | FreeSpinsMummyBonus;

export type MummyResponse = SlotGameResponse<MummyBonus>;
