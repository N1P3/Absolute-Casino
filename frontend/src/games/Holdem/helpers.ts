export const getCardDisplayName = (card: string): string => {
  if (!card || card.length < 2) return "?";

  const valueMap: Record<string, string> = {
    T: "10",
    J: "J",
    Q: "Q",
    K: "K",
    A: "A",
  };

  const suitMap: Record<string, string> = {
    H: "♥",
    D: "♦",
    C: "♣",
    S: "♠",
  };

  const value = valueMap[card[0]] || card[0];
  const suit = suitMap[card[1]] || "?";

  return `${value}${suit}`;
};

export const getSuitSymbol = (suit: string): string => {
  const suitMap: Record<string, string> = {
    H: "♥ Hearts",
    D: "♦ Diamonds",
    C: "♣ Clubs",
    S: "♠ Spades",
  };
  return suitMap[suit] || "?";
};

export const getCardValue = (card: string): number => {
  if (card.length < 1) return 0;
  const valueMap: Record<string, number> = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    T: 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };
  return valueMap[card[0]] || 0;
};

export const getCardSuit = (card: string): string => {
  return card.length > 1 ? card[1] : "";
};

export const formatPot = (pot: number): string => {
  if (pot >= 1000000) return `${(pot / 1000000).toFixed(1)}M`;
  if (pot >= 1000) return `${(pot / 1000).toFixed(1)}K`;
  return pot.toString();
};

export const formatStack = (stack: number): string => {
  if (stack >= 1000000) return `${(stack / 1000000).toFixed(1)}M`;
  if (stack >= 1000) return `${(stack / 1000).toFixed(1)}K`;
  return stack.toString();
};

