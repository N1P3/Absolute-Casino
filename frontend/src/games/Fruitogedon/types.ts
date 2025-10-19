import { Bonus, SlotGameResponse } from "@/engine/types";

type WildFreezeBonus = {
  type: "WILD_FREEZE";
  frozenColumns: number[];
  freeSpinsLeft: number;
} & Bonus;

export type FruitogedonBonus = WildFreezeBonus;

export type FruitogedonResponse = SlotGameResponse<FruitogedonBonus>;
