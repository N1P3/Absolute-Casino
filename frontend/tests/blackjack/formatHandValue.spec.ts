import { formatHandValue } from "@/games/Blackjack/helpers";
import { describe, expect, it } from "vitest";

describe("blackjack/formatHandValue", () => {
  it("blackjack_combinations_correctValue", () => {
    expect(formatHandValue(["A", "K"])).toBe("21");
    expect(formatHandValue(["Q", "A"])).toBe("21");
    expect(formatHandValue(["A", "T"])).toBe("21");
  });

  it("single_validSums_correctValue", () => {
    expect(formatHandValue(["K", "5"])).toBe("15");
    expect(formatHandValue(["2", "3"])).toBe("5");
    expect(formatHandValue(["7", "8"])).toBe("15");
    expect(formatHandValue(["5", "7", "4"])).toBe("16");
  });

  it("multiple_validOptions_correctValue", () => {
    expect(formatHandValue(["A", "5"])).toBe("6 / 16");
    expect(formatHandValue(["A", "2", "5"])).toBe("8 / 18");
    expect(formatHandValue(["A", "A", "3"])).toBe("5 / 15");
  });

  it("bustValue_correctValue", () => {
    expect(formatHandValue(["K", "Q", "5"])).toBe("25");
    expect(formatHandValue(["9", "J", "K"])).toBe("29");
    expect(formatHandValue(["T", "8", "7"])).toBe("25");
  });

  it("complexAceScenarios_correctValue", () => {
    expect(formatHandValue(["A", "A", "9"])).toBe("11 / 21");
    expect(formatHandValue(["A", "9", "A"])).toBe("11 / 21");
    expect(formatHandValue(["A", "A", "A", "8"])).toBe("11 / 21");
    expect(formatHandValue(["A", "A", "A", "9"])).toBe("12");
  });

  it("edge_cases_withManyCards_correctValue", () => {
    expect(formatHandValue(["2", "3", "4", "5", "6"])).toBe("20");
    expect(formatHandValue(["A", "2", "3", "4"])).toBe("10 / 20");
    expect(formatHandValue(["A", "A", "A", "A", "7"])).toBe("11 / 21");
  });

  it("bustWithAces_correctValue", () => {
    expect(formatHandValue(["A", "K", "Q"])).toBe("21");
    expect(formatHandValue(["A", "K", "Q", "2"])).toBe("23");
    expect(formatHandValue(["A", "A", "K", "Q"])).toBe("22");
  });

  it("emptyHands_correctValue", () => {
    expect(formatHandValue([])).toBe("0");
  });

  it("prioritizeHighestValidSum_correctValue", () => {
    expect(formatHandValue(["A", "6", "A", "3"])).toBe("11 / 21");
    expect(formatHandValue(["A", "2", "A", "7"])).toBe("11 / 21");
  });
});
