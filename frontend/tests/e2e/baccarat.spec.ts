import { test, expect, Page } from "@playwright/test";
import { mockBaccaratWebsocket, mockUserDetails, USER_DETAILS_URL } from "./utils";

test("player betting on PLAYER wins", async ({ page }) => {
  await mockUserDetails(page);
  await mockBaccaratWebsocket(page, {
    deal: {
      player_cards: ["6H", "5D", "9C"], // Player total: 0
      dealer_cards: ["KC", "5S"], // Banker total: 5
      players_result: "WIN",
      money_won: 10, // Win amount for 5 stake
    },
  });

  await page.goto("/game/baccarat");

  // Click the PLAYER button to place bet
  await page.getByRole("button", { name: "PLAYER" }).click();

  // Take a screenshot of the winning state
  await expect(page).toHaveScreenshot("baccarat-player-win.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player betting on BANKER wins", async ({ page }) => {
  await mockUserDetails(page);
  await mockBaccaratWebsocket(page, {
    deal: {
      player_cards: ["3H", "2D"], // Player total: 5
      dealer_cards: ["9C", "8S", "2H"], // Banker total: 9
      players_result: "WIN",
      money_won: 9.5, // Win amount with 5% commission
    },
  });

  await page.goto("/game/baccarat");

  // Click the BANKER button to place bet
  await page.getByRole("button", { name: "BANKER" }).click();

  // Take a screenshot of the winning state
  await expect(page).toHaveScreenshot("baccarat-banker-win.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player betting on TIE wins", async ({ page }) => {
  await mockUserDetails(page);
  await mockBaccaratWebsocket(page, {
    deal: {
      player_cards: ["7H", "2D"], // Player total: 9
      dealer_cards: ["6C", "3S"], // Banker total: 9
      players_result: "WIN",
      money_won: 40, // 8:1 payout for tie bet
    },
  });

  await page.goto("/game/baccarat");

  // Click the TIE button to place bet
  await page.getByRole("button", { name: "TIE" }).click();

  // Take a screenshot of the winning state
  await expect(page).toHaveScreenshot("baccarat-tie-win.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player betting on PLAYER loses", async ({ page }) => {
  await mockUserDetails(page);
  await mockBaccaratWebsocket(page, {
    deal: {
      player_cards: ["2H", "3D"], // Player total: 5
      dealer_cards: ["7C", "3S"], // Banker total: 0
      players_result: "LOST",
      money_won: 0,
    },
  });

  await page.goto("/game/baccarat");

  // Click the PLAYER button to place bet
  await page.getByRole("button", { name: "PLAYER" }).click();

  // Take a screenshot of the losing state
  await expect(page).toHaveScreenshot("baccarat-player-lose.png", {
    maxDiffPixelRatio: 0.01,
    timeout: 10000,
  });
});

test("third card dealing rule is applied", async ({ page }) => {
  await mockUserDetails(page);
  await mockBaccaratWebsocket(page, {
    deal: {
      player_cards: ["2H", "3D", "8C"], // Player gets a third card
      dealer_cards: ["7C", "3S", "5D"], // Banker gets a third card too
      players_result: "WIN",
      money_won: 10,
    },
  });

  await page.goto("/game/baccarat");

  // Click the PLAYER button to place bet
  await page.getByRole("button", { name: "PLAYER" }).click();

  // Take a screenshot of the game with all 6 cards
  await expect(page).toHaveScreenshot("baccarat-third-card-rule.png", {
    maxDiffPixelRatio: 0.01,
    timeout: 10000,
  });
});

test("changing stake values works correctly", async ({ page }) => {
  await mockUserDetails(page);

  await page.goto("/game/baccarat");

  // Default stake should be 5
  await expect(page.getByText("Stawka").locator("..").getByText("5")).toBeVisible();

  // Increase stake
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByText("Stawka").locator("..").getByText("10")).toBeVisible();

  // Increase again
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByText("Stawka").locator("..").getByText("25")).toBeVisible();

  // Decrease stake
  await page.getByRole("button", { name: "-" }).click();
  await expect(page.getByText("Stawka").locator("..").getByText("10")).toBeVisible();
});

test("player can't bet with insufficient funds", async ({ page }) => {
  // Mock user with low balance
  await page.route(USER_DETAILS_URL, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Poor Player",
        balance: 2, // Not enough for minimum stake
      }),
    });
  });

  await mockBaccaratWebsocket(page, {
    deal: {
      Type: "ERROR",
      Message: "Insufficient funds",
    },
  });

  await page.goto("/game/baccarat");

  // Click the PLAYER button to place bet
  await page.getByRole("button", { name: "PLAYER" }).click();

  // Should show error toast
  await expect(page.getByText("Insufficient funds", { exact: true })).toBeVisible();
});

test("game displays card totals correctly", async ({ page }) => {
  await mockUserDetails(page);
  await mockBaccaratWebsocket(page, {
    deal: {
      player_cards: ["6H", "7D"], // Player total: 3
      dealer_cards: ["9C", "8S"], // Banker total: 7
      players_result: "LOST",
      money_won: 0,
    },
  });

  await page.goto("/game/baccarat");

  // Click the PLAYER button to place bet
  await page.getByRole("button", { name: "PLAYER" }).click();

  // Wait for animation to complete
  await page.waitForTimeout(3000);

  // Take a screenshot of the game with correct totals
  await expect(page).toHaveScreenshot("baccarat-card-totals.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("all game elements are correctly positioned", async ({ page }) => {
  await mockUserDetails(page);

  await page.goto("/game/baccarat");

  await page.waitForLoadState("networkidle");

  // Take a screenshot of the entire game layout
  await expect(page).toHaveScreenshot("baccarat-game-layout.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});
