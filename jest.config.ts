import type { Config } from "jest"

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  // ts-jest transforms TypeScript source files
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      tsconfig: { jsx: "react-jsx" },
    }],
  },
  // Treat .js ESM packages as needing transformation
  transformIgnorePatterns: [
    "/node_modules/(?!(face-api\\.js)/)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Stub CSS / static assets
    "\\.(css|scss|svg|png|jpg)$": "<rootDir>/__mocks__/fileMock.js",
  },
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
}

export default config
