import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  setupFiles: ["<rootDir>/tests/env.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  clearMocks: true,
  testTimeout: 30000,
};

export default config;
