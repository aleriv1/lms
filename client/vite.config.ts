import react from "@vitejs/plugin-react";
import { reactClickToComponent } from "vite-plugin-react-click-to-component";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), reactClickToComponent()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
