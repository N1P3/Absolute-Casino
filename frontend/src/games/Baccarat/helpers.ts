import { CardValue } from "../shared";

export const calculateSum = (cards: CardValue[]): number => {
  let sum = 0;
  cards.forEach((value) => {
    // const cardValue = ["K", "Q", "J", "T"].includes(value) ? 0 : value === "A" ? 1 : parseInt(value);
    // sums = sums.map((sum) => sum + cardValue);
    if (value === "A") {
      sum += 1;
    } else if (["K", "Q", "J", "T"].includes(value)) {
      sum += 10;
    } else {
      sum += parseInt(value);
    }
  });

  return sum % 10;
};

// export const formatHandValue = (cards: CardValue[]): string => {
//   const sums = calculatePossibleSums(cards);
//   const validSums = sums.filter((sum) => sum <= 9).sort((a, b) => a - b);
//   return Math.max(...validSums).toString();
// };
