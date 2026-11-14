/** @type {import('jest').Config} */
const sharedMapper = {
  '^@/(.*)$': '<rootDir>/$1',
};

module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/lib/', '/build/'],
      setupFiles: ['<rootDir>/__tests__/nodeExpoStubs.js'],
      moduleNameMapper: sharedMapper,
      rootDir: __dirname,
    },
    {
      displayName: 'screens',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/__tests__/screens/**/*.test.tsx'],
      globalSetup: '<rootDir>/__tests__/screens/globalSetup.js',
      setupFiles: ['<rootDir>/__tests__/screens/setTz.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/screens/setup.ts'],
      moduleNameMapper: sharedMapper,
      rootDir: __dirname,
    },
  ],
};
