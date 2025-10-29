import { CardKey, CardValue } from "../shared";

export const getRandomCard = (): CardKey => {
  const suits = ["H", "D", "C", "S"];
  const values = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "T",
    "J",
    "Q",
    "K",
    "A",
  ];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const value = values[Math.floor(Math.random() * values.length)];
  return `${value}${suit}` as CardKey;
};

export const canPlayCard = (
  card: CardKey,
  tableCard: CardKey,
  currentSuit: string | null
): boolean => {
  const cardValue = card[0] as CardValue;
  const cardSuit = card[1];
  const tableValue = tableCard[0] as CardValue;
  const tableSuit = tableCard[1];

  // Jeśli jest aktywny wybrany kolor (po zagraniu Asa lub Jokera)
  if (currentSuit) {
    return cardSuit === currentSuit || cardValue === "A" || cardValue === "J";
  }

  // Można zagrać kartę o tym samym kolorze lub wartości
  return (
    cardValue === tableValue ||
    cardSuit === tableSuit ||
    cardValue === "A" ||
    cardValue === "J"
  );
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
    J: "Jopek",
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

  return `${valueMap[card[0]]} ${suitMap[card[1]]}`;
};
