import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium' },
  webServer: { command: 'pnpm exec vite --host 127.0.0.1', url: 'http://127.0.0.1:3000', reuseExistingServer: false },
})
