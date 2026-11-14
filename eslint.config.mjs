import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * eslint-config-next 16 起直接导出扁平配置数组（`Linter.Config[]`），
 * 不再需要 `FlatCompat` 把 eslintrc 风格的对象翻译成扁平配置。
 */
const config = [
  {
    // .worktrees/** 是并行阶段工作树，里面是同一仓库的源码副本，不应参与主工作区的 lint
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', '.worktrees/**'],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // 图片主机名由站点主人决定，无法写死 remotePatterns，见 next.config.ts
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 契约层需要精确表达官方响应的可选/未知字段
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default config
