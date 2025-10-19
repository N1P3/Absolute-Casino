import { CardValue } from "../shared";
import { HandPositions } from "./types";

export const calculatePossibleSums = (cards: CardValue[]): number[] => {
  let sums = [0];
  let numAces = 0;

  cards.forEach((value) => {
    if (value === "A") {
      numAces++;
    } else {
      const cardValue = ["K", "Q", "J", "T"].includes(value) ? 10 : parseInt(value);
      sums = sums.map((sum) => sum + cardValue);
    }
  });

  // Handle aces
  for (let i = 0; i < numAces; i++) {
    const newSums: number[] = [];
    sums.forEach((sum) => {
      newSums.push(sum + 1);
      if (sum + 11 <= 21) {
        newSums.push(sum + 11);
      }
    });
    sums = [...new Set(newSums)];
  }

  return sums;
};

export const formatHandValue = (cards: CardValue[]): string => {
  const sums = calculatePossibleSums(cards);
  const validSums = sums.filter((sum) => sum <= 21).sort((a, b) => a - b);
  //blackjack
  if (validSums.includes(21) && cards.length === 2) return "21";
  //bust
  if (validSums.length === 0) return Math.min(...sums).toString();
  //normal
  if (validSums.length === 1) return validSums[0].toString();
  //options
  return `${validSums[0]} / ${validSums[validSums.length - 1]}`;
};

export const POSITIONS = {
  deck: { x: 2800, y: 300 },
  hand: { x: 1600, y: 1500 },
  handSplit1: { x: 2000, y: 1500 },
  handSplit2: { x: 1200, y: 1500 },
  dealer: { x: 1600, y: 350 },
} as const;

export const getHandPosition = (position: HandPositions) => {
  switch (position) {
    case "player":
      return POSITIONS.hand;
    case "player_split_1":
      return POSITIONS.handSplit1;
    case "player_split_2":
      return POSITIONS.handSplit2;
    case "dealer":
      return POSITIONS.dealer;
  }
};
