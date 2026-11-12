/**
 * 外部样式表输出
 *
 * 把一组已校验的外部 CSS 地址渲染成普通的 `<link rel="stylesheet">`。
 * 纯服务端渲染：浏览器按 href 自己取样式，主题不代发请求、不注入内容。
 *
 * 为什么用 `precedence`：React 19 会把带 `precedence` 的样式表提升到
 * `<head>`，并按 precedence 分组排序（同组内保持传入顺序）。这样
 * 「哪一组覆盖哪一组」由框架保证，而不是靠组件恰好写在 body 的哪个位置。
 *
 * 这里不做任何校验——URL 已经在校验层处理过。组件保持「有就输出、
 * 没有就不输出」这一件事，避免同一套规则散落在两处、各自演化。
 */
export function StylesheetLinks({
  urls,
  precedence,
}: {
  urls: string[]
  precedence: string
}) {
  if (urls.length === 0) return null

  return (
    <>
      {urls.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence={precedence} />
      ))}
    </>
  )
}
