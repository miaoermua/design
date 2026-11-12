import { CUSTOM_CSS_MAX_URLS, CUSTOM_CSS_URL_MAX_LENGTH } from './defaults'

/**
 * 外部样式表 URL 校验
 *
 * `custom.css` 的语义是「一组外部 CSS 地址」，服务端把它们渲染成
 * `<link rel="stylesheet" href="...">`。因此这里唯一要做的事情是：
 * **保证每个 href 都是合法的 http(s) 绝对地址**。
 *
 * 拒绝的类别（每一类都对应一种「href 里出现非预期协议」的路径）：
 *   - `javascript:` / `data:` / `vbscript:` —— 伪协议，点击或加载即可执行；
 *   - 协议相对 `//host/x` —— 会继承当前页协议，在多域名部署下指向预期之外的主机；
 *   - 相对路径 `/x.css` —— 看起来无害，但地址取决于当前页 URL，
 *     Snippet 的作者无法确定它最终指向哪里；
 *   - 其它协议（`ftp:`、`file:`、`blob:` …）—— 浏览器不会按样式表加载，
 *     保留只会得到一个静默失效的 link。
 *
 * ## 这不是「内容安全」
 *
 * URL 校验只保证「链接指向一个 HTTP 资源」，**不保证那个资源里的 CSS 是安全的**。
 * 外部样式表可以 `@import` 别的样式、可以 `url()` 请求追踪像素、可以隐藏或伪造
 * 页面元素。一旦允许外部 CSS，这些都随之进来——这是选择该功能的固有成本，
 * 不是本模块能解决的问题。本模块挡住的是「配置直接变成 HTML/JS」，
 * 不是「外部资源不可信」。
 *
 * 不做的事情：
 *   - 不去请求 URL 验证可达性（SSR 不能因为第三方慢而变慢）；
 *   - 不做协议白名单之外的域名限制（站点拥有者自己决定信任哪个 CDN）；
 *   - 不尝试对 URL 做 HTML 转义（React 的 `href` 属性已由框架转义）。
 */

export interface CustomCssUrlResult {
  /** 通过校验的地址：已去重、已截断到上限；空数组表示不输出 link */
  urls: string[]
  /** 被跳过的条目及原因，仅供诊断与测试，不进入页面输出 */
  rejected: { value: string; reason: string }[]
}

const MAX_URLS = CUSTOM_CSS_MAX_URLS
const MAX_URL_LENGTH = CUSTOM_CSS_URL_MAX_LENGTH

/**
 * 校验单条地址。
 *
 * 用 `new URL()` 而不是正则：URL 的解析规则（大小写、默认端口、
 * 百分号编码、用户信息）复杂到正则无法正确覆盖，手写正则只会
 * 产生「看起来拦住了但其实没拦住」的假安全感。
 */
export function normalizeCssUrl(value: unknown): { url: string } | { reason: string } {
  if (typeof value !== 'string') return { reason: '不是字符串' }

  const trimmed = value.trim()
  if (!trimmed) return { reason: '空地址' }
  if (trimmed.length > MAX_URL_LENGTH) return { reason: `超过 ${MAX_URL_LENGTH} 字符` }

  // 协议相对地址必须先拦：`new URL` 在没有 base 时会直接抛错，
  // 但错误信息区分不出「没写协议」和「写了个坏地址」，这里给出明确原因。
  if (trimmed.startsWith('//')) return { reason: '协议相对地址（缺少 http/https）' }

  // 控制字符（含换行、制表符）可以切断 href，必须显式拒绝
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return { reason: '包含控制字符' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { reason: '不是绝对 URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { reason: `不支持的协议 ${parsed.protocol}` }
  }

  // `new URL` 会把 `HTTP://` 归一化为 `http://`，这里再用正则确认一次
  // 原始字符串确实以 http(s):// 开头——挡住 `http:evil` 这类「能被解析
  // 但没有 //」的特殊写法。
  if (!/^https?:\/\//i.test(trimmed)) return { reason: '不是 http(s) 绝对地址' }

  // 必须有主机名：`http:///path` 能被解析但加载不出任何东西
  if (!parsed.hostname) return { reason: '缺少主机名' }

  return { url: parsed.toString() }
}

/**
 * 校验并归一化一组外部样式表地址。
 *
 * **单条非法只跳过该条**，不影响其它合法地址——一个过期 CDN 链接
 * 不应该让整组自定义样式失效。去重后按上限截断，保持配置里的原始顺序
 * （样式表靠顺序决定优先级，重排会改变覆盖关系）。
 */
export function normalizeCustomCssList(input: unknown): CustomCssUrlResult {
  if (!Array.isArray(input)) return { urls: [], rejected: [] }

  const urls: string[] = []
  const rejected: { value: string; reason: string }[] = []
  /** 去重键用归一化后的地址，`https://a/x` 与 `https://a/x/` 视为不同地址 */
  const seen = new Set<string>()

  for (const item of input) {
    if (urls.length >= MAX_URLS) {
      // 超出上限的条目也记一条诊断，便于配置作者知道「多写的没生效」
      rejected.push({
        value: typeof item === 'string' ? item : String(item),
        reason: `超过 ${MAX_URLS} 条上限`,
      })
      continue
    }

    const result = normalizeCssUrl(item)
    if ('reason' in result) {
      rejected.push({
        value: typeof item === 'string' ? item : String(item),
        reason: result.reason,
      })
      continue
    }

    if (seen.has(result.url)) {
      rejected.push({ value: result.url, reason: '重复地址' })
      continue
    }

    seen.add(result.url)
    urls.push(result.url)
  }

  return { urls, rejected }
}
