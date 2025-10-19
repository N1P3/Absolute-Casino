import { test, expect, Page } from "@playwright/test";
import { mockFruitogedonWebsocket, mockUserDetails } from "./utils";

test("displays correct symbols after spin", async ({ page }) => {
  await mockUserDetails(page);
  await mockFruitogedonWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      winningLines: [],
      moneyWon: 0,
      bonus: null,
      multiplier: 1,
      jackpot: null,
    },
  });

  await page.goto("/game/fruitogedon");

  // Click the spin button
  await page.getByRole("button", { name: "SPIN" }).click();

  await expect(page.getByRole("button", { name: "SPIN" })).toBeEnabled({ timeout: 20000 });

  // Take a screenshot to verify symbols are displayed correctly
  await expect(page).toHaveScreenshot("fruitogedon-symbols.png", { maxDiffPixelRatio: 0.01 });
});

test("displays wild freeze bonus information when triggered", async ({ page }) => {
  await mockUserDetails(page);
  await mockFruitogedonWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 1, 2, 3, 4],
        [1, 2, 3, 4, 0],
        [2, 3, 4, 0, 1],
      ],
      winningLines: [],
      moneyWon: 0,
      multiplier: 1,
      bonus: {
        type: "WILD_FREEZE",
        freeSpinsLeft: 3,
        message: "Wild symbols will freeze for 3 spins!",
        frozenColumns: [1, 3],
      },
      jackpot: null,
    },
  });

  await page.goto("/game/fruitogedon");
  await page.getByRole("button", { name: "SPIN" }).click();

  // Wait for spin animation to complete
  await page.waitForTimeout(10000);

  // Check if bonus modal is visible
  await expect(page.getByText("Otrzymujesz bonus!")).toBeVisible();
  await expect(page.getByText("Wild symbols will freeze for 3 spins!")).toBeVisible();

  // Take a screenshot of the bonus modal
  await expect(page).toHaveScreenshot("fruitogedon-bonus.png", { maxDiffPixelRatio: 0.01 });

  // Close bonus modal
  await page.getByRole("button", { name: "Ok" }).click();

  // Verify the free spins counter is displayed
  await expect(page.getByText("Pozostało free spins").locator("..").getByText("3")).toBeVisible();
});

test("displays jackpot when triggered", async ({ page }) => {
  await mockUserDetails(page);
  await mockFruitogedonWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      winningLines: [],
      moneyWon: 5000,
      multiplier: 1,
      bonus: null,
      jackpot: {
        amount: 5000,
      },
    },
  });

  await page.goto("/game/fruitogedon");
  await page.getByRole("button", { name: "SPIN" }).click();

  // Wait for spin animation to complete
  await page.waitForTimeout(10000);

  // Check if jackpot modal is visible
  await expect(page.getByText("JACKPOT!")).toBeVisible();

  // Take a screenshot of the jackpot modal
  await expect(page).toHaveScreenshot("fruitogedon-jackpot.png", { maxDiffPixelRatio: 0.01 });

  // Close jackpot modal
  await page.getByRole("button", { name: "Ok" }).click();
});

test("shows frozen symbols correctly", async ({ page }) => {
  await mockUserDetails(page);
  // First spin to trigger the bonus
  await mockFruitogedonWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 1, 2, 3, 4],
        [1, 2, 3, 4, 0],
        [2, 3, 4, 0, 1],
      ],
      winningLines: [],
      moneyWon: 0,
      multiplier: 1,
      bonus: {
        type: "WILD_FREEZE",
        freeSpinsLeft: 3,
        message: "Wild symbols will freeze for 3 spins!",
        frozenColumns: [1, 3],
      },
      jackpot: null,
    },
  });

  await page.goto("/game/fruitogedon");
  await page.getByRole("button", { name: "SPIN" }).click();

  // Wait for spin animation to complete
  await page.waitForTimeout(10000);

  // Close bonus modal
  await page.getByRole("button", { name: "Ok" }).click();

  // Take a screenshot to verify frozen symbols
  await expect(page).toHaveScreenshot("fruitogedon-frozen-symbols.png", { maxDiffPixelRatio: 0.01 });
});

test("changing stake values works correctly", async ({ page }) => {
  await mockUserDetails(page);

  await page.goto("/game/fruitogedon");

  // Default stake should be 1
  await expect(page.getByText("Stawka").locator("..").getByText("1")).toBeVisible();

  // Increase stake
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByText("Stawka").locator("..").getByText("2")).toBeVisible();

  // Increase again
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByText("Stawka").locator("..").getByText("5")).toBeVisible();

  // Decrease stake
  await page.getByRole("button", { name: "-" }).click();
  await expect(page.getByText("Stawka").locator("..").getByText("2")).toBeVisible();
});

test("stake buttons are disabled during bonus rounds", async ({ page }) => {
  await mockUserDetails(page);
  await mockFruitogedonWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 1, 2, 3, 4],
        [1, 2, 3, 4, 0],
        [2, 3, 4, 0, 1],
      ],
      winningLines: [],
      moneyWon: 0,
      multiplier: 1,
      bonus: {
        type: "WILD_FREEZE",
        freeSpinsLeft: 3,
        message: "Wild symbols will freeze for 3 spins!",
        frozenColumns: [1, 3],
      },
      jackpot: null,
    },
  });

  await page.goto("/game/fruitogedon");
  await page.getByRole("button", { name: "SPIN" }).click();

  // Wait for spin animation to complete
  await page.waitForTimeout(10000);

  // Close bonus modal
  await page.getByRole("button", { name: "Ok" }).click();

  // Check that stake adjustment buttons are disabled during bonus
  await expect(page.getByRole("button", { name: "+" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "-" })).toBeDisabled();
});

test("spin button is disabled during animations", async ({ page }) => {
  await mockUserDetails(page);
  await mockFruitogedonWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      winningLines: [],
      moneyWon: 0,
      bonus: null,
      multiplier: 1,
      jackpot: null,
    },
  });

  await page.goto("/game/fruitogedon");

  // Click the spin button
  await page.getByRole("button", { name: "SPIN" }).click();

  // During animation, the spin button should be disabled
  await expect(page.getByRole("button", { name: "SPIN" })).toBeDisabled();

  // After animation completes, the button should be enabled again
  await expect(page.getByRole("button", { name: "SPIN" })).toBeEnabled({ timeout: 20000 });
});
