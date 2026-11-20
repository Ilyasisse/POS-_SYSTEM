const config = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          target: "es2022",
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "es6" },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^server-only$": "<rootDir>/tests/workflow/server-marker.cjs",
    "^next/image$": "<rootDir>/tests/workflow/next-image.mjs",
    "^next/server$": "next/server.js",
    "^next/headers$": "next/headers.js",
  },
};

export default config;
