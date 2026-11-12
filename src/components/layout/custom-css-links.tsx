import type { ThemeCustom } from '@/core/config/theme'

/**
 * 自定义样式表输出
 *
 * `custom.css` 是一组**外部 CSS URL**，这里把它渲染成普通的
 * `<link rel="stylesheet">`。这一步是纯服务端渲染：
 *   - 浏览器按 href 自己取样式，主题不代发请求、不注入内容；
 *   - 不需要任何客户端 JS，也不参与 hydration；
 *   - 地址已经在 parser 阶段校验、去重、截断，这里不再二次判断。
 *
 * 为什么用 `precedence`：React 19 会把带 `precedence` 的样式表提升到
 * `<head>`，并按 precedence 分组排序（同组内保持配置顺序）。这样
 * 「自定义样式覆盖主题样式」这条顺序契约由框架保证，而不是靠
 * 它恰好写在 body 的哪个位置。
 *
 * 关于安全边界，这里必须说清楚：**校验的是 URL，不是 CSS 内容**。
 * 通过校验只说明「这是一个 http(s) 绝对地址」，被引用的样式表里可以
 * 有 `@import`、可以 `url()` 打点、可以隐藏页面元素——那些是这个功能
 * 的固有代价。挡住的只是「配置文本直接变成 HTML/JS」这条路。
 */
export function CustomCssLinks({ custom }: { custom: ThemeCustom }) {
  if (custom.css.length === 0) return null

  return (
    <>
      {custom.css.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="folio-custom" />
      ))}
    </>
  )
}
