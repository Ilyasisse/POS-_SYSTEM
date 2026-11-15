import shared from "./jest.shared.mjs";

const config = {
  ...shared,
  testMatch: ["<rootDir>/tests/unit/*.test.ts", "<rootDir>/tests/integration/*.test.mjs"],
  // These existing files contain only export {}; and have no test cases.
  testPathIgnorePatterns: ["/node_modules/", "/tests/unit/(helpers|inventory|orders)\\.test\\.ts$"],
  testTimeout: 30_000,
};

export default config;
