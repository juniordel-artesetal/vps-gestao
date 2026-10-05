// Vitest (guia do Next 16: node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md).
// Por enquanto só testes de LÓGICA PURA do módulo MAE (ambiente node, sem jsdom).
// O alias "@/..." do tsconfig é resolvido nativamente pelo Vite (resolve.tsconfigPaths).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['lib/mae/**/*.test.ts', 'lib/tiktok/**/*.test.ts'],
  },
})
