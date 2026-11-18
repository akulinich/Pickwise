import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Pickwise/",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
