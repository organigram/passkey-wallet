import { defineConfig, devices } from 'playwright/test'

// Runs the built wallet (app-dist) on its own, without the Organigram Stack.
// Build it first with `pnpm build:app`.
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173'
  },
  webServer: {
    command: 'pnpm exec vite preview --host localhost --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: process.env.CI !== 'true'
  }
})
