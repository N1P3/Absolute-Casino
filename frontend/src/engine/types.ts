export type Line = [[number, number], [number, number], [number, number], [number, number], [number, number]];

export enum Jackpot {
  MINI = 0,
  MINOR = 1,
  MAJOR = 2,
  GRAND = 3,
}

export type Bonus = {
  type: string;
  message: string;
};

export type SlotGameResponse<T extends Bonus | null = null> = {
  winningLines: { [key: string]: Line }[];
  gameBoard: number[][];
  multiplier: number;
  moneyWon: number;
  jackpot: Jackpot | null;
  bonus: T | null;
};
