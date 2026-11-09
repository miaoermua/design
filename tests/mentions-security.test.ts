import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'
import { sanitizeRenderedHtml } from '@/lib/content/sanitize'

/** 带 md-mention 类名的 <a> 的 href */
function mentionHrefsOf(html: string): string[] {
  return [...html.matchAll(/<a class="md-mention[^"]*" href="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href))
}

describe('提及安全：用户名注入', () => {
  it('用户名里的标签不会被解析成元素', async () => {
    const { html } = await renderMarkdown('{GH@Innei<script>alert(1)</script>}')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
    expect(html).not.toContain('md-mention')
    expect(html).toContain('{GH@Innei')
  })

  it('双引号属性注入退化为原文', async () => {
    const { html } = await renderMarkdown('{GH@Innei" onmouseover="alert(1)}')

    expect(html).not.toContain('md-mention')
    expect(html).not.toMatch(/<a[^>]*onmouseover/i)
    expect(html).toContain('{GH@Innei')
  })

  it('单引号属性注入退化为原文', async () => {
    const { html } = await renderMarkdown("{TW@Innei' onmouseover='alert(1)}")

    expect(html).not.toContain('md-mention')
    expect(html).not.toMatch(/<a[^>]*onmouseover/i)
  })

  it('尖括号闭合标签注入退化为原文', async () => {
    const { html } = await renderMarkdown('{TG@Innei</a><img src=x onerror=alert(1)>}')

    // 原始 HTML 里的 <img> 是项目既有权限，这里只关心事件属性被清掉、
    // 提及本身没有被解析成功
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('md-mention')
    expect(html).toContain('{TG@Innei')
  })

  it('用户名里的空白不会被拼进 URL', async () => {
    const { html } = await renderMarkdown('{GH@Innei Innei}')

    expect(html).not.toContain('md-mention')
    expect(html).toContain('{GH@Innei Innei}')
  })
})

describe('提及安全：URL 注入', () => {
  it('协议注入不能改变链接协议', async () => {
    const { html } = await renderMarkdown('{GH@javascript:alert(1)}')

    expect(html).not.toContain('href="javascript')
    expect(html).not.toContain('md-mention')
  })

  it('主机名注入不会产出提及链接', async () => {
    // 含 `.` 的用户名不满足校验，因此不会被拼成 github.com/evil.test；
    // 正文里的 `GH@evil.test` 会被 marked 的邮箱自动链接规则变成 mailto:（既有行为）
    const { html } = await renderMarkdown('{GH@evil.test/x}')

    expect(html).not.toContain('md-mention')
    expect(html).not.toContain('github.com')
    expect(html).toContain('GH@evil.test')
  })

  it('路径穿越退化为原文', async () => {
    const { html } = await renderMarkdown('{TW@../../admin}')

    expect(html).not.toContain('md-mention')
    expect(html).toContain('{TW@../../admin}')
  })

  it('产出的提及链接只指向三个允许的平台', async () => {
    const { html } = await renderMarkdown('{GH@Innei} {TW@Innei} {TG@Innei}')

    const hrefs = mentionHrefsOf(html)
    expect(hrefs).toHaveLength(3)

    for (const href of hrefs) {
      expect(new URL(href).protocol).toBe('https:')
      expect(['github.com', 'twitter.com', 't.me']).toContain(new URL(href).hostname)
    }
  })

  it('外部链接照旧补 noopener noreferrer', async () => {
    const { html } = await renderMarkdown('{GH@Innei}')

    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })
})

describe('提及安全：原始 HTML 无法伪造受信任结构', () => {
  it('作者手写的 md-mention 类名会被摘掉（a 标签）', async () => {
    const { html } = await renderMarkdown(
      '<a class="md-mention md-mention--gh" href="https://evil.test/x">假 GH</a>',
    )

    expect(html).not.toContain('md-mention')
    // 链接本身仍是普通外链，与作者直接写 Markdown 链接的权限一致
    expect(html).toContain('href="https://evil.test/x"')
  })

  it('作者手写的 md-mention 类名会被摘掉（非 a 标签）', async () => {
    const { html } = await renderMarkdown('<span class="md-mention md-mention--tw">伪装</span>')

    expect(html).not.toContain('md-mention')
    expect(html).toContain('伪装')
  })

  it('同文档里有真实提及时，伪造的那条仍然拿不到类名', async () => {
    const { html } = await renderMarkdown(
      '{GH@Innei}\n\n<a class="md-mention md-mention--gh" href="https://evil.test/x">假 GH</a>',
    )

    expect(mentionHrefsOf(html)).toEqual(['https://github.com/Innei'])
    expect(html).not.toContain('md-mention--gh" href="https://evil.test')
  })

  it('真实提及与普通外链互不干扰', async () => {
    const { html } = await renderMarkdown('{TW@Innei} 与 [官网](https://example.test)')

    expect(mentionHrefsOf(html)).toEqual(['https://twitter.com/Innei'])
    expect(html).toContain('href="https://example.test"')
    expect(html).toContain('>官网</a>')
  })
})

describe('提及安全：清洗幂等', () => {
  it('同一份 HTML 在相同上下文下清洗两次结果一致', async () => {
    const { html } = await renderMarkdown(
      '{GH@Innei} 与 `{TW@Innei}` 与 <span class="md-mention">x</span>',
    )
    const context = { mentionHrefs: new Set(['https://github.com/Innei']) }

    const once = sanitizeRenderedHtml(html, context)
    const twice = sanitizeRenderedHtml(once, context)

    expect(twice).toBe(once)
    expect(once).not.toContain('md-mention">x')
  })

  it('没有上下文时提及样式不会被保留（默认收紧）', async () => {
    const { html } = await renderMarkdown('{GH@Innei}')
    const stripped = sanitizeRenderedHtml(html)

    expect(stripped).not.toContain('md-mention')
    expect(stripped).toContain('href="https://github.com/Innei"')
  })
})
