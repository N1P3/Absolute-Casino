import { defineProject } from "vitest/config";
import { resolve } from "path";

export default defineProject({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
