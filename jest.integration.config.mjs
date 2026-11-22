import shared from "./jest.shared.mjs";

const config = {
  ...shared,
  testMatch: ["<rootDir>/tests/integration/*.test.ts"],
  testTimeout: 90_000,
};

export default config;
