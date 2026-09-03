import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    reporters: [
      'default',
      ['junit', {
        suiteName: 'frontend.frontend_tests',
        classnameTemplate: 'frontend.frontend_tests.{filename}',
        outputFile: './frontend-test-results.xml',
      }],
    ],
  },
})