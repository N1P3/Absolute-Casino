import { CardKey, CardValue } from "../shared";

export const canPlayCard = (
  card: CardKey,
  tableCard: CardKey,
  currentSuit: string | null,
  requiredNumber: string | null,
  pendingDrawCount: number,
  drawType: string | null,
  pendingSkipTurns?: number,
  playerToSkip?: number | null,
  myPlayerId?: number | null
): boolean => {
  const cardValue = card[0] as CardValue;
  const cardSuit = card[1];

  // If there's a playerToSkip set and it's me, I can only play a 4
  if (
    playerToSkip !== null &&
    playerToSkip !== undefined &&
    myPlayerId !== null &&
    myPlayerId !== undefined
  ) {
    if (playerToSkip === myPlayerId) {
      return cardValue === "4";
    }
  }

  if (pendingDrawCount > 0) {
    if (drawType === "2") return cardValue === "2";
    if (drawType === "3") return cardValue === "3";
    if (drawType === "K")
      return cardValue === "K" && (cardSuit === "H" || cardSuit === "S");
    return false;
  }

  if (requiredNumber) {
    return cardValue === requiredNumber;
  }

  if (currentSuit) {
    return cardSuit === currentSuit || cardValue === "A";
  }

  const tableValue = tableCard[0] as CardValue;
  const tableSuit = tableCard[1];

  if (cardValue === "A") return true;

  return cardValue === tableValue || cardSuit === tableSuit;
};

export const getCardDisplayName = (card: CardKey): string => {
  const valueMap: Record<string, string> = {
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    T: "10",
    J: "Walet",
    Q: "Dama",
    K: "Król",
    A: "As",
  };

  const suitMap: Record<string, string> = {
    H: "♥",
    D: "♦",
    C: "♣",
    S: "♠",
  };

  return `${valueMap[card[0]] || card[0]} ${suitMap[card[1]] || ""}`.trim();
};

export const getSuitSymbol = (suit: string): string => {
  const suitMap: Record<string, string> = {
    H: "♥",
    D: "♦",
    C: "♣",
    S: "♠",
  };
  return suitMap[suit] || suit;
};
