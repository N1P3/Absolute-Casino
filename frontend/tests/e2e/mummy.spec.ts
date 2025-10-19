import { test, expect, Page } from "@playwright/test";
import { mockMummyWebsocket, mockUserDetails } from "./utils";

test("displays correct symbols after spin", async ({ page }) => {
  await mockUserDetails(page);
  await mockMummyWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      winningLines: [],
      moneyWon: 0,
      bonus: null,
    },
  });

  await page.goto("/game/mummy");

  // Click the spin button
  await page.getByRole("button", { name: "SPIN" }).click();

  await expect(page.getByRole("button", { name: "SPIN" })).toBeEnabled({ timeout: 20000 });

  // Take a screenshot to verify symbols are displayed correctly
  await expect(page).toHaveScreenshot("mummy-symbols.png", { maxDiffPixelRatio: 0.01 });
});

test("displays bonus information when triggered", async ({ page }) => {
  await mockUserDetails(page);
  await mockMummyWebsocket(page, {
    spin: {
      gameBoard: [
        [0, 1, 2, 3, 4],
        [1, 2, 3, 4, 0],
        [2, 3, 4, 0, 1],
      ],
      winningLines: [],
      moneyWon: 0,
      bonus: {
        type: "FREE_SPINS",
        freeSpinsLeft: 10,
        message: "You've won 10 free spins!",
      },
    },
  });

  await page.goto("/game/mummy");
  await page.getByRole("button", { name: "SPIN" }).click();

  // Wait for spin animation to complete
  await page.waitForTimeout(10000);

  // Check if bonus modal is visible
  await expect(page.getByText("Otrzymujesz bonus!")).toBeVisible();
  await expect(page.getByText("You've won 10 free spins!")).toBeVisible();

  // Take a screenshot of the bonus modal
  await expect(page).toHaveScreenshot("mummy-bonus.png", { maxDiffPixelRatio: 0.01 });

  // Close bonus modal
  await page.getByRole("button", { name: "Ok" }).click();

  // Verify the free spins counter is displayed
  await expect(page.getByText("Pozostało free spins").locator("..").getByText("10")).toBeVisible();
});

test("changing stake values works correctly", async ({ page }) => {
  await mockUserDetails(page);

  await page.goto("/game/mummy");

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
