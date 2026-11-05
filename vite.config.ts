import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The API only accepts these origins (see the cors() allowlist in server.cjs),
  // so fail fast instead of silently moving to another port when one is busy.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '*.test.mjs'],
  },
})
