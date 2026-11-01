import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  watchman: false,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          target: 'ESNext',
          resolveJsonModule: true,
          esModuleInterop: true,
          types: ['jest', 'node']
        },
        // ui/ imports this package by name, which ts-jest cannot resolve;
        // `pnpm typecheck:app` type-checks ui/ and its tests instead.
        diagnostics: { exclude: ['**/ui/**'] },
        useESM: true
      }
    ]
  }
}

export default config
