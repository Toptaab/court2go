/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // @repo/domain and @repo/types are authored as ESM source (verbatim
        // module syntax, `type: module`), but ts-jest runs tests as CJS to
        // avoid the ESM/Jest interop headaches — transpile ES2022 -> CommonJS
        // for the test run only (does not affect the package's published
        // ESM entrypoints, which are just the .ts source itself).
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          verbatimModuleSyntax: false,
          isolatedModules: false,
          types: ['jest'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@repo/types$': '<rootDir>/../types/src/index.ts',
    '^@repo/types/enums$': '<rootDir>/../types/src/enums/index.ts',
  },
};
