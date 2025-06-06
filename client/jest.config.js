module.exports = {
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!axios)/', // Transform axios
  ],
  moduleNameMapper: {
    '\\.(css|less)$': 'identity-obj-proxy', // Mock CSS imports
  },
  testEnvironment: 'jsdom', // For React DOM testing
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'], // Use the setupTests.js file
};
