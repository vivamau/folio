module.exports = {
  watchman: false,
  projects: [
    {
      displayName: "api",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/backend*.test.js"],
    },
    {
      displayName: "ui",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/frontend*.test.jsx"],
      transform: {
        "^.+\\.[jt]sx?$": [
          "babel-jest",
          {
            presets: [
              ["@babel/preset-env", { targets: { node: "current" } }],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          },
        ],
      },
    },
  ],
  collectCoverageFrom: [
    "backend/*.js",
    "frontend/src/{App,api,format}.js",
    "frontend/src/**/*.jsx",
  ],
  coverageThreshold: {
    global: { statements: 85, branches: 85, functions: 85, lines: 85 },
  },
};
