import { defineConfig } from "vitest/config";
export default defineConfig({test: {include: ["src/**/*.test.ts"], env: {LOG_LEVEL: "silent", NODE_ENV: "test", AUTH_PROVIDER: "local"}}});
