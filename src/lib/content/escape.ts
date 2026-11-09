/**
 * HTML 转义（服务端渲染用）
 *
 * 只用于渲染器自己拼字符串的场景：属性值与文本分别按各自规则转义，
 * 不做任何“顺手清洗”，真正的安全边界在 `./sanitize`。
 */

export function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
