import { Page } from "@playwright/test";

export const USER_DETAILS_URL = "http://localhost:8081/api/details";
const MUMMY_WS_URL = "ws://localhost:8081/ws/mummy";
const BACCARAT_WS_URL = "ws://localhost:8081/ws/baccarat";
const BLACKJACK_WS_URL = "ws://localhost:8081/ws/blackjack";
const FRUITOGEDON_WS_URL = "ws://localhost:8081/ws/fruits";
// Mock user details API to return a fixed balance
export const mockUserDetails = async (page: Page) => {
  await page.route(USER_DETAILS_URL, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Test User",
        balance: 1000,
      }),
    });
  });
};

// Mock the mummy game websocket with controlled responses
export const mockMummyWebsocket = async (page: Page, handlers: Record<string, any>) => {
  await page.routeWebSocket(MUMMY_WS_URL, (ws) => {
    ws.onMessage((msg) => {
      const message = JSON.parse(msg as string);
      const command = message.command;

      if (handlers[command]) {
        ws.send(JSON.stringify(handlers[command]));
      } else {
        console.log(`No handler for command: ${command}`);
      }
    });
  });
};

// Mock the baccarat game websocket with controlled responses
export const mockBaccaratWebsocket = async (page: Page, handlers: Record<string, any>) => {
  await page.routeWebSocket(BACCARAT_WS_URL, (ws) => {
    ws.onMessage((msg) => {
      const message = JSON.parse(msg as string);
      const command = message.command;

      if (handlers[command]) {
        ws.send(JSON.stringify(handlers[command]));
      } else {
        console.log(`No handler for command: ${command}`);
      }
    });
  });
};

// Mock the blackjack websocket to return controlled responses
export const mockBlackjackWebsocket = async (page: Page, handlers: Record<string, any>) => {
  await page.routeWebSocket(BLACKJACK_WS_URL, (ws) => {
    ws.onMessage((msg) => {
      const message = JSON.parse(msg as string);
      const command = message.command;

      if (handlers[command]) {
        ws.send(JSON.stringify(handlers[command]));
      } else {
        console.log(`No handler for command: ${command}`);
      }
    });
  });
};

// Mock the fruitogedon game websocket with controlled responses
export const mockFruitogedonWebsocket = async (page: Page, handlers: Record<string, any>) => {
  await page.routeWebSocket(FRUITOGEDON_WS_URL, (ws) => {
    ws.onMessage((msg) => {
      const message = JSON.parse(msg as string);
      const command = message.command;

      if (handlers[command]) {
        ws.send(JSON.stringify(handlers[command]));
      } else {
        console.log(`No handler for command: ${command}`);
      }
    });
  });
};
