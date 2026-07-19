import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  watchman: false,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@organigram/js$': '<rootDir>/__mocks__/organigram-js.ts',
    '^wagmi$': '<rootDir>/__mocks__/wagmi.ts'
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
        diagnostics: false,
        useESM: true
      }
    ]
  }
}

export default config
