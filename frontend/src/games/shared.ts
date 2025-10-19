import { Assets, Texture } from "pixi.js";

// Define card suits and values
const suits = ["H", "D", "C", "S"] as const;
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

export type CardSuit = (typeof suits)[number];
export type CardValue = (typeof values)[number];

// Create an object to store all card textures
export type CardKey = `${CardValue}${CardSuit}` | "BB" | "BR";

export const loadCardTextures = async () => {
  const cardTextures: Record<CardKey, Texture> = {} as Record<CardKey, Texture>;

  for (const suit of suits) {
    for (const value of values) {
      const key = `${value.toUpperCase()}${suit}`;
      const url = (await import(`@/assets/cards/${key}.svg?url`)).default as string;
      cardTextures[key as CardKey] = await Assets.load(url);
    }
  }

  //BB = Back Black
  //BR = Back Red
  // cardTextures["BB"] = (await import("@/assets/cards/1B.svg?url")).default;
  // cardTextures["BR"] = (await import("@/assets/cards/2B.svg?url")).default;

  cardTextures["BB"] = await Assets.load((await import("@/assets/cards/1B.svg?url")).default);
  cardTextures["BR"] = await Assets.load((await import("@/assets/cards/2B.svg?url")).default);

  return cardTextures;
};
