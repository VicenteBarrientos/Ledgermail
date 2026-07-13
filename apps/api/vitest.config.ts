import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Prevent apps/src/index.ts from calling app.listen() during tests:
    // the app only skips listen() when NODE_ENV === "production" AND VERCEL is set.
    env: {
      NODE_ENV: "production",
      VERCEL: "1"
    }
  }
});
