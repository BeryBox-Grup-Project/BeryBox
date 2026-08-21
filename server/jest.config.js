module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  globalSetup: '<rootDir>/jest.globalSetup.js',
  collectCoverageFrom: [
    'app.js',
    'controllers/**/*.js',
    'helpers/**/*.js',
    'middlewares/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    'socket/**/*.js',
    'models/**/*.js',
    '!models/index.js',
    '!bin/**',
    '!migrations/**',
    '!seeders/**',
  ],
  coverageThreshold: {
    global: {
      statements: 90.01,
      branches: 90.01,
      functions: 90.01,
      lines: 90.01,
    },
  },
};
