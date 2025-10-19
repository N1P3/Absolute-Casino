import { calculateSum } from "@/games/Baccarat/helpers";
import { describe, expect, it } from "vitest";

describe("Baccarat calculateSum", () => {
  it("emptyArray_returns_0", () => {
    expect(calculateSum([])).toBe(0);
  });

  it("numericCards_correctSum", () => {
    expect(calculateSum(["2"])).toBe(2);
    expect(calculateSum(["5"])).toBe(5);
    expect(calculateSum(["9"])).toBe(9);
  });

  it("faceCards_return_0", () => {
    expect(calculateSum(["T"])).toBe(0);
    expect(calculateSum(["J"])).toBe(0);
    expect(calculateSum(["Q"])).toBe(0);
    expect(calculateSum(["K"])).toBe(0);
  });

  it("Aces_correctSum", () => {
    expect(calculateSum(["A"])).toBe(1);
  });

  it("multipleCards_correctSum", () => {
    expect(calculateSum(["2", "3"])).toBe(5);
    expect(calculateSum(["5", "7"])).toBe(2); // In Baccarat, only the last digit counts (12 -> 2)
    expect(calculateSum(["9", "8"])).toBe(7); // 17 -> 7
  });

  it("faceCards_withOtherCards_correctSum", () => {
    expect(calculateSum(["K", "5"])).toBe(5);
    expect(calculateSum(["2", "Q"])).toBe(2);
    expect(calculateSum(["J", "T", "K"])).toBe(0);
  });

  it("Aces_withOtherCards_correctSum", () => {
    expect(calculateSum(["A", "5"])).toBe(6);
    expect(calculateSum(["K", "A"])).toBe(1);
    expect(calculateSum(["A", "9"])).toBe(0); // 10 -> 0
  });

  it("complexCombinations_correctSum", () => {
    expect(calculateSum(["A", "A", "8"])).toBe(0); // 10 -> 0
    expect(calculateSum(["K", "Q", "5"])).toBe(5);
    expect(calculateSum(["9", "J", "2"])).toBe(1); // 11 -> 1
    expect(calculateSum(["5", "7", "4"])).toBe(6); // 16 -> 6
  });

  it("modulo10_rule_correctSum", () => {
    expect(calculateSum(["9", "9"])).toBe(8); // 18 -> 8
    expect(calculateSum(["9", "9", "9"])).toBe(7); // 27 -> 7
    expect(calculateSum(["9", "9", "9", "9"])).toBe(6); // 36 -> 6
  });
});
