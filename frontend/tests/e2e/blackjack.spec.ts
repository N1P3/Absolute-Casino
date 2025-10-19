import { test, expect, Page } from "@playwright/test";
import { mockBlackjackWebsocket, mockUserDetails, USER_DETAILS_URL } from "./utils";

test("dealing displays cards and changes game state", async ({ page }) => {
  await mockUserDetails(page);
  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["AH", "TD"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "UNRESOLVED",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: true,
      splitable: false,
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "25", exact: true }).click();

  // After dealing, action buttons should appear
  await expect(page.locator("text=Hit")).toBeVisible();
  await expect(page.locator("text=Stand")).toBeVisible();
  await expect(page.locator("text=Double")).toBeVisible();
  await expect(page.locator("text=Split")).not.toBeVisible();
});

test("player gets blackjack and wins immediately", async ({ page }) => {
  await mockUserDetails(page);
  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["AH", "JD"],
      player_split_cards: [],
      dealer_cards: ["TC", "5S"],
      result: "WIN",
      result_split: null,
      money_won: 150, // 2.5x the bet of 50
      money_won_split: null,
      doublable: false,
      splitable: false,
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "50", exact: true }).click();

  await expect(page).toHaveScreenshot("blackjack-win.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player hits and busts", async ({ page }) => {
  await mockUserDetails(page);
  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["TH", "8D"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "UNRESOLVED",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: true,
      splitable: false,
    },
    hit: {
      player_cards: ["TH", "8D", "QC"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "LOST",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: false,
      splitable: false,
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "100", exact: true }).click();
  await page.locator("text=Hit").click();

  await expect(page).toHaveScreenshot("hit-bust.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player stands and wins", async ({ page }) => {
  await mockUserDetails(page);
  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["TH", "9D"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "UNRESOLVED",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: true,
      splitable: false,
    },
    stand: {
      player_cards: ["TH", "9D"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S", "7D"], // Dealer gets 22, busts
      result: "WIN",
      result_split: null,
      money_won: 200, // 2x the bet
      money_won_split: null,
      doublable: false,
      splitable: false,
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "100", exact: true }).click();
  await page.locator("text=Stand").click();

  await expect(page).toHaveScreenshot("stand-win.png", {
    maxDiffPixelRatio: 0.01,
  });
});

// test("player doubles and wins", async ({ page }) => {
//   await mockUserDetails(page);
//   await mockBlackjackWebsocket(page, {
//     deal: {
//       player_cards: ["6H", "5D"],
//       player_split_cards: [],
//       dealer_cards: ["KC", "5S"],
//       result: "UNRESOLVED",
//       result_split: null,
//       money_won: 0,
//       money_won_split: null,
//       doublable: true,
//       splitable: false,
//     },
//     double: {
//       player_cards: ["6H", "5D", "TC"],
//       player_split_cards: [],
//       dealer_cards: ["KC", "5S", "JD"], // Dealer gets 25, busts
//       result: "WIN",
//       result_split: null,
//       money_won: 400, // 2x the doubled bet
//       money_won_split: null,
//       doublable: false,
//       splitable: false,
//     },
//   });

//   await page.goto("/game/blackjack");
//   await page.getByRole("button", { name: "100", exact: true }).click();
//   await page.locator("text=Double").click();

//   await expect(page).toHaveScreenshot("double-win.png", {
//     maxDiffPixelRatio: 0.01,
//     timeout: 10000,
//   });
// });

test("player splits and wins both hands", async ({ page }) => {
  await mockUserDetails(page);
  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["AH", "AD"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "UNRESOLVED",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: true,
      splitable: true,
    },
    split: {
      player_cards: ["AH", "TD"],
      player_split_cards: ["AD", "JC"],
      dealer_cards: ["KC", "5S"],
      result: "WIN",
      result_split: "WIN",
      money_won: 100,
      money_won_split: 100,
      doublable: true,
      splitable: false,
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "50", exact: true }).click();
  await page.locator("text=Split").click();
  // await page.locator("text=Stand").click();

  await expect(page).toHaveScreenshot("split-2x-21-win.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player gets draw result", async ({ page }) => {
  await mockUserDetails(page);
  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["TH", "9D"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "UNRESOLVED",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: true,
      splitable: false,
    },
    stand: {
      player_cards: ["TH", "9D"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S", "4D"], // Dealer gets 19 too
      result: "DRAW",
      result_split: null,
      money_won: 100, // Return original bet
      money_won_split: null,
      doublable: false,
      splitable: false,
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "100", exact: true }).click();
  await page.locator("text=Stand").click();

  await expect(page).toHaveScreenshot("stand-draw.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("player can't double with insufficient funds", async ({ page }) => {
  await page.route(USER_DETAILS_URL, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Poor Player",
        balance: 60, // Just enough for initial bet
      }),
    });
  });

  await mockBlackjackWebsocket(page, {
    deal: {
      player_cards: ["6H", "5D"],
      player_split_cards: [],
      dealer_cards: ["KC", "5S"],
      result: "UNRESOLVED",
      result_split: null,
      money_won: 0,
      money_won_split: null,
      doublable: true,
      splitable: false,
    },
    double: {
      Type: "ERROR",
      Message: "Insufficient funds",
    },
  });

  await page.goto("/game/blackjack");
  await page.getByRole("button", { name: "50", exact: true }).click();
  await page.locator("text=Double").click();

  // Should show error toast
  await expect(page.getByText("Insufficient funds", { exact: true })).toBeVisible();
});
