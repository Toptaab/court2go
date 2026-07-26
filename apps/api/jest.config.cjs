/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@repo/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@repo/types/enums$': '<rootDir>/../../packages/types/src/enums/index.ts',
    '^@repo/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
};
