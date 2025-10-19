import { calculatePossibleSums } from "@/games/Blackjack/helpers";
import { describe, expect, it } from "vitest";

describe("blackjack/calculatePossibleSums", () => {
  it("single_10_value_card_correctSum", () => {
    expect(calculatePossibleSums(["T"])).toEqual([10]);
    expect(calculatePossibleSums(["J"])).toEqual([10]);
    expect(calculatePossibleSums(["Q"])).toEqual([10]);
    expect(calculatePossibleSums(["K"])).toEqual([10]);
  });

  it("numericCards_correctSum", () => {
    expect(calculatePossibleSums(["2"])).toEqual([2]);
    expect(calculatePossibleSums(["7"])).toEqual([7]);
  });

  it("single_Ace_correctSum", () => {
    expect(calculatePossibleSums(["A"])).toEqual([1, 11]);
  });

  it("multipleNumericCards_correctSum", () => {
    expect(calculatePossibleSums(["2", "3"])).toEqual([5]);
    expect(calculatePossibleSums(["5", "7", "4"])).toEqual([16]);
  });

  it("faceCards_withNumericCards_correctSum", () => {
    expect(calculatePossibleSums(["K", "5"])).toEqual([15]);
    expect(calculatePossibleSums(["2", "Q", "4"])).toEqual([16]);
  });

  it("single_Ace_correctSum", () => {
    expect(calculatePossibleSums(["A", "5"])).toEqual([6, 16]);
    expect(calculatePossibleSums(["K", "A"])).toEqual([11, 21]);
  });

  it("multipleAces_correctSum", () => {
    expect(calculatePossibleSums(["A", "A"])).toEqual([2, 12]);
    expect(calculatePossibleSums(["A", "A", "A"])).toEqual([3, 13]);
  });

  it("Aces_withOtherCards_correctSum", () => {
    expect(calculatePossibleSums(["A", "A", "9"])).toEqual([11, 21]);
    expect(calculatePossibleSums(["J", "A", "A"])).toEqual([12, 22]);
  });

  it("blackjack_combination_correctSum", () => {
    expect(calculatePossibleSums(["A", "K"])).toEqual([11, 21]);
    expect(calculatePossibleSums(["Q", "A"])).toEqual([11, 21]);
  });

  it("uniquePossibleSums_correctSum", () => {
    expect(calculatePossibleSums(["5", "A", "3", "A"])).toEqual([10, 20]);
  });

  it("emptyArray_correctSum", () => {
    expect(calculatePossibleSums([])).toEqual([0]);
  });
});
