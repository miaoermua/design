import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig 为 Next 保留了 `jsx: preserve`，测试里显式交给 oxc 转成 automatic runtime
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
