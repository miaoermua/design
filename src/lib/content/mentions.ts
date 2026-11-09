/**
 * 社交账号提及（服务端）：Kami 生态的 `{GH@name}` / `{TW@name}` / `{TG@name}`
 *
 *   {GH@Innei} → <a class="md-mention md-mention--gh" href="https://github.com/Innei" …>Innei</a>
 *
 * 与 Kami 一致的语义（核对过 mx-space/kami 的
 * `src/components/ui/Markdown/parsers/mention.tsx`）：
 *   - 只有 GH / TW / TG 三个大写前缀；`{gh@x}`、`{XX@x}` 一律不解析，原样保留；
 *   - 用户名不做大小写转换，按作者写法进入 URL；
 *   - URL 前缀固定为 https://github.com/ 、https://twitter.com/ 、https://t.me/ ；
 *   - 在新窗口打开，链接组件的展示文字是用户名本身。
 *
 * 有意与 Kami 不同的地方（详见 docs/audit/MARKDOWN-STEP2D-REPORT.md）：
 *   - Kami 的用户名规则是 `\w+`（不接受连字符），而 GitHub 用户名允许 `-`，
 *     这里 GH 放宽为「字母数字开头结尾，中间可含 - 或 _」；TW / TG 保持 `[A-Za-z0-9_]`；
 *   - Kami 会吞掉 mention 后面的一个空格，并且在后面紧跟 `[...]` 时放弃匹配；
 *     这里不消费任何空白，也不因后续内容放弃匹配（不静默修改作者正文）；
 *   - 不支持 Kami 的可选显示名 `[显示名]{GH@name}`：本阶段只做三种官方语法。
 *
 * 安全边界：
 *   - 平台标识来自白名单常量表，作者只能影响 URL 的最后一段路径；
 *   - 用户名先过字符集校验才会进入渲染，字符集里没有引号、空格、`<`、`:`、`/`，
 *     因此既不能注入属性 / 标签，也不能改变协议与主机；
 *   - 产出的 href 登记进本次渲染的 `mentionHrefs`，安全边界据此只保留真实产出的
 *     mention 样式类：作者手写 `<a class="md-mention" href="https://evil.test">`
 *     会被摘掉类名，无法伪装成系统产出的提及。
 */

import type { MarkedExtension, Tokens } from 'marked'
import { escapeAttribute, escapeText } from './escape'

interface PlatformSpec {
  /** 固定的协议 + 主机 + 路径前缀，作者无法改写 */
  href: string
  /**
   * 用户名字符集。
   * 末尾的 `{0,62}` / `{1,64}` 只是输出体积上限，不是平台规则；
   * 真实用户名最长 39（GitHub）、15（Twitter）、32（Telegram）。
   */
  name: RegExp
  /** 样式类：供 mentions.css 区分平台 */
  className: string
}

const PLATFORMS: Record<string, PlatformSpec> = {
  GH: {
    href: 'https://github.com/',
    name: /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/,
    className: 'md-mention--gh',
  },
  TW: {
    href: 'https://twitter.com/',
    name: /^[A-Za-z0-9_]{1,64}$/,
    className: 'md-mention--tw',
  },
  TG: {
    href: 'https://t.me/',
    name: /^[A-Za-z0-9_]{1,64}$/,
    className: 'md-mention--tg',
  },
}

/** `{平台@用户名}`：平台先只取两字母，是否认识交给白名单判断 */
const MENTION = /^\{([A-Za-z]{2})@([^}\n]*)\}/

interface MentionToken extends Tokens.Generic {
  type: 'mention'
  platform: string
  name: string
}

/**
 * 构建提及扩展。
 *
 * `registerHref` 在渲染每个提及时回调，供调用方登记「本次渲染真实产出的链接」；
 * 摘要 / 图注这类 `renderInline()` 场景不需要登记，直接不传。
 */
export function createMentionExtension(registerHref?: (href: string) => void): MarkedExtension {
  return {
    extensions: [
      {
        name: 'mention',
        level: 'inline',
        // `{` 是唯一的起手字符：把这个位置告诉 marked，文本 token 才会在这里切开
        start(src) {
          const index = src.indexOf('{')
          return index >= 0 ? index : undefined
        },
        tokenizer(src) {
          const match = MENTION.exec(src)
          if (!match) return undefined

          const platform = match[1] ?? ''
          const spec = PLATFORMS[platform]
          if (!spec) return undefined

          const name = match[2] ?? ''
          if (!spec.name.test(name)) return undefined

          // 链接文字 / 图片 alt 里不能再套一个 <a>：交给上层按普通文本处理
          if (this.lexer.state.inLink) return undefined

          const token: MentionToken = { type: 'mention', raw: match[0], platform, name }
          return token
        },
        renderer(token) {
          const mention = token as MentionToken
          const spec = PLATFORMS[mention.platform]
          if (!spec) return escapeText(typeof mention.raw === 'string' ? mention.raw : '')

          const href = `${spec.href}${mention.name}`
          registerHref?.(href)

          return [
            `<a class="md-mention ${spec.className}"`,
            ` href="${escapeAttribute(href)}"`,
            ' target="_blank" rel="noopener noreferrer">',
            escapeText(mention.name),
            '</a>',
          ].join('')
        },
      },
    ],
  }
}
