import type { ThemeCustom } from '@/core/config/theme'
import { StylesheetLinks } from './stylesheet-links'

/**
 * 自定义样式表输出
 *
 * `custom.css` 是一组**外部 CSS URL**，渲染成 `<link rel="stylesheet">`。
 * 地址已经在 parser 阶段校验、去重、截断，这里只做输出。
 *
 * 关于安全边界，这里必须说清楚：**校验的是 URL，不是 CSS 内容**。
 * 通过校验只说明「这是一个 http(s) 绝对地址」，被引用的样式表里可以
 * 有 `@import`、可以 `url()` 打点、可以隐藏页面元素——那些是这个功能
 * 的固有代价。挡住的只是「配置文本直接变成 HTML/JS」这条路。
 */
export function CustomCssLinks({ custom }: { custom: ThemeCustom }) {
  return <StylesheetLinks urls={custom.css} precedence="folio-custom" />
}
