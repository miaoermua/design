import { describe, expect, it } from 'vitest'
import {
  CUSTOM_CSS_MAX_URLS,
  DEFAULT_THEME_CONFIG,
  HOME_LIMIT_MAX,
  HOME_LIMIT_MIN,
  footerYearRange,
  normalizeCustomCssList,
  normalizeCssUrl,
  parseFooter,
  parseHomepage,
  parseThemeConfig,
  safeHttpUrl,
} from '@/core/config/theme'

const YEAR = 2026

describe('Theme：safeHttpUrl', () => {
  it('接受 http / https 绝对地址并归一化', () => {
    expect(safeHttpUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/')
    expect(safeHttpUrl('  https://example.com/x  ')).toBe('https://example.com/x')
  })

  it('拒绝伪协议、协议相对地址与非字符串', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull()
    expect(safeHttpUrl('//evil.example/x')).toBeNull()
    expect(safeHttpUrl('ftp://example.com')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(safeHttpUrl(42)).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
  })
})

describe('Theme：Footer', () => {
  it('合法配置全部保留', () => {
    const footer = parseFooter(
      {
        since: 2021,
        links: [
          { name: '友链', url: 'https://example.com/friends' },
          { name: '留言', url: 'https://example.com/message' },
        ],
        icp: { enabled: true, label: '沪ICP备00000000号', url: 'https://beian.miit.gov.cn/' },
      },
      YEAR,
    )
    expect(footer.since).toBe(2021)
    expect(footer.links).toHaveLength(2)
    expect(footer.icp).toEqual({
      enabled: true,
      label: '沪ICP备00000000号',
      url: 'https://beian.miit.gov.cn/',
    })
  })

  it('非法链接被独立忽略，合法链接仍然保留', () => {
    const footer = parseFooter(
      {
        links: [
          { name: '坏链接', url: 'javascript:alert(1)' },
          { name: '好链接', url: 'https://example.com/ok' },
          { name: '', url: 'https://example.com/empty-name' },
          { name: '无地址' },
        ],
      },
      YEAR,
    )
    expect(footer.links).toEqual([{ name: '好链接', url: 'https://example.com/ok' }])
  })

  it('since 超出合理区间时降级为 null', () => {
    expect(parseFooter({ since: 1800 }, YEAR).since).toBeNull()
    expect(parseFooter({ since: 99999 }, YEAR).since).toBeNull()
    expect(parseFooter({ since: 'abc' }, YEAR).since).toBeNull()
    expect(parseFooter({ since: 2020.7 }, YEAR).since).toBe(2020)
  })

  it('ICP 关闭、缺 label、URL 非法时的表现', () => {
    expect(parseFooter({ icp: { enabled: false, label: 'X' } }, YEAR).icp.enabled).toBe(false)
    expect(parseFooter({ icp: { label: '' } }, YEAR).icp).toEqual({
      enabled: false,
      label: null,
      url: null,
    })
    // 有 label 但 URL 非法：保留 label 供展示，url 置空由 UI 退到官方查询入口
    const icp = parseFooter({ icp: { label: 'X', url: 'javascript:x' } }, YEAR).icp
    expect(icp.enabled).toBe(true)
    expect(icp.label).toBe('X')
    expect(icp.url).toBeNull()
  })

  it('年份区间：跨年显示区间，同年只显示一个', () => {
    expect(footerYearRange(2021, 2026)).toBe('2021–2026')
    expect(footerYearRange(2026, 2026)).toBe('2026')
    expect(footerYearRange(null, 2026)).toBe('2026')
  })
})

describe('Theme：Social', () => {
  it('order 生效且未列出的平台排在后面', () => {
    const config = parseThemeConfig({
      social: { order: ['bilibili', 'github'], icons: {} },
    })
    expect(config.social.order).toEqual(['bilibili', 'github'])
  })

  it('图标只接受图标名，拒绝 SVG / HTML', () => {
    const config = parseThemeConfig({
      social: {
        icons: {
          github: 'github',
          evil: '<svg onload="alert(1)">',
          alsoBad: 'has space',
        },
      },
    })
    expect(config.social.icons).toEqual({ github: 'github' })
  })

  it('order 中重复与非法键被清理', () => {
    const config = parseThemeConfig({
      social: { order: ['github', 'github', '<script>', 'x', 42] },
    })
    expect(config.social.order).toEqual(['github', 'x'])
  })
})

describe('Theme：Homepage', () => {
  it('limit 收敛到上下限', () => {
    const config = parseThemeConfig({
      homepage: { articles: { limit: 999 }, notes: { limit: 0 } },
    })
    expect(config.homepage.articles.limit).toBe(HOME_LIMIT_MAX)
    expect(config.homepage.notes.limit).toBe(HOME_LIMIT_MIN)
  })

  it('缺失时回退默认值', () => {
    const config = parseThemeConfig({ homepage: {} })
    expect(config.homepage.articles).toEqual(DEFAULT_THEME_CONFIG.homepage.articles)
    expect(config.homepage.notes).toEqual(DEFAULT_THEME_CONFIG.homepage.notes)
    expect(config.homepage.profile.enabled).toBe(true)
  })

  it('区块可关闭', () => {
    const config = parseThemeConfig({
      homepage: {
        profile: { enabled: false },
        articles: { enabled: false },
        notes: { enabled: false },
      },
    })
    expect(config.homepage.profile.enabled).toBe(false)
    expect(config.homepage.articles.enabled).toBe(false)
    expect(config.homepage.notes.enabled).toBe(false)
  })

  it('非数字 limit 回退到默认值而不是 1', () => {
    const fallback = parseHomepage({ articles: { limit: 'abc' } }, DEFAULT_THEME_CONFIG.homepage)
    expect(fallback.articles.limit).toBe(DEFAULT_THEME_CONFIG.homepage.articles.limit)
  })
})

describe('Theme：Donate', () => {
  it('默认关闭、文案为「赞赏」、二维码为空', () => {
    expect(DEFAULT_THEME_CONFIG.donate).toEqual({ enabled: false, label: '赞赏', qrcode: [] })
    expect(parseThemeConfig({}).donate).toEqual(DEFAULT_THEME_CONFIG.donate)
  })

  it('只有显式 true 才开启', () => {
    expect(parseThemeConfig({ donate: { enabled: true } }).donate.enabled).toBe(true)
    for (const value of ['true', 1, 'yes', {}]) {
      expect(parseThemeConfig({ donate: { enabled: value } }).donate.enabled).toBe(false)
    }
  })

  it('label 缺失或非法时退回默认值，超长被截断', () => {
    expect(parseThemeConfig({ donate: { enabled: true } }).donate.label).toBe('赞赏')
    expect(parseThemeConfig({ donate: { label: 42 } }).donate.label).toBe('赞赏')
    expect(parseThemeConfig({ donate: { label: '打赏作者' } }).donate.label).toBe('打赏作者')
    expect(parseThemeConfig({ donate: { label: '赞'.repeat(40) } }).donate.label).toHaveLength(16)
  })

  it('二维码按配置顺序保留名称与地址', () => {
    const config = parseThemeConfig({
      donate: {
        enabled: true,
        qrcode: [
          { name: '微信', url: 'https://static.example.com/wechat.webp' },
          { name: '支付宝', url: 'https://static.example.com/alipay.webp' },
        ],
      },
    })
    expect(config.donate.qrcode).toEqual([
      { name: '微信', url: 'https://static.example.com/wechat.webp' },
      { name: '支付宝', url: 'https://static.example.com/alipay.webp' },
    ])
  })

  it('非法二维码地址逐条丢弃，不影响其它条目', () => {
    const config = parseThemeConfig({
      donate: {
        enabled: true,
        qrcode: [
          { name: '坏', url: 'javascript:alert(1)' },
          { name: '数据', url: 'data:image/png;base64,AAAA' },
          { name: '相对', url: '/img/qr.png' },
          { name: '协议相对', url: '//evil.example/qr.png' },
          { name: '好', url: 'https://static.example.com/ok.webp' },
        ],
      },
    })
    expect(config.donate.qrcode).toEqual([
      { name: '好', url: 'https://static.example.com/ok.webp' },
    ])
  })

  it('同一地址只保留第一次出现，名称缺失时按序号兜底', () => {
    const config = parseThemeConfig({
      donate: {
        qrcode: [
          { url: 'https://static.example.com/a.webp' },
          { name: '重复', url: 'https://static.example.com/a.webp' },
          { url: 'https://static.example.com/b.webp' },
        ],
      },
    })
    expect(config.donate.qrcode).toEqual([
      { name: '二维码 1', url: 'https://static.example.com/a.webp' },
      { name: '二维码 2', url: 'https://static.example.com/b.webp' },
    ])
  })

  it('超过 4 条时截断，非数组退化为空数组', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({
      name: `码 ${index}`,
      url: `https://static.example.com/${index}.webp`,
    }))
    expect(parseThemeConfig({ donate: { qrcode: many } }).donate.qrcode).toHaveLength(4)
    expect(
      parseThemeConfig({ donate: { qrcode: 'https://a.example/x.webp' } }).donate.qrcode,
    ).toEqual([])
  })

  it('旧 site / page 字段被忽略，不再出现在解析结果里', () => {
    const config = parseThemeConfig({
      donate: {
        site: { enabled: true, label: '赞助', url: 'https://example.com/sponsor' },
        page: { enabled: true, slug: 'sponsor' },
      },
    })
    expect(Object.keys(config.donate).sort()).toEqual(['enabled', 'label', 'qrcode'])
    expect(config.donate.enabled).toBe(false)
  })
})

describe('Theme：BanDevtool', () => {
  it('默认关闭', () => {
    expect(parseThemeConfig({}).bandevtool.enabled).toBe(false)
    expect(DEFAULT_THEME_CONFIG.bandevtool.enabled).toBe(false)
  })

  it('只有显式 true 才开启', () => {
    expect(parseThemeConfig({ bandevtool: { enabled: true } }).bandevtool.enabled).toBe(true)
    expect(parseThemeConfig({ bandevtool: { enabled: 'yes' } }).bandevtool.enabled).toBe(false)
    expect(parseThemeConfig({ bandevtool: { enabled: 1 } }).bandevtool.enabled).toBe(false)
  })
})

describe('Theme：整体解析', () => {
  it('非对象输入返回完整默认配置', () => {
    for (const input of [null, undefined, [], 'string', 42]) {
      const config = parseThemeConfig(input)
      expect(config).toEqual(DEFAULT_THEME_CONFIG)
    }
  })

  it('未知字段被忽略，不影响已知字段', () => {
    const config = parseThemeConfig({
      unknownRoot: { a: 1 },
      footer: { since: 2020, unknownField: 'x' },
    })
    expect(config.footer.since).toBe(2020)
    expect('unknownRoot' in config).toBe(false)
  })

  it('单个字段非法不影响其它字段', () => {
    const config = parseThemeConfig({
      footer: { since: 'bad', links: [{ name: '坏', url: 'javascript:x' }] },
      homepage: { articles: { enabled: false } },
      donate: { enabled: true, qrcode: [{ name: '好', url: 'https://ok.example/qr.webp' }] },
    })
    expect(config.footer.since).toBeNull()
    expect(config.footer.links).toEqual([])
    expect(config.homepage.articles.enabled).toBe(false)
    expect(config.donate.enabled).toBe(true)
    expect(config.donate.qrcode).toHaveLength(1)
  })
})

describe('Theme：Custom CSS URL 校验', () => {
  it('接受 http / https 绝对地址并归一化', () => {
    expect(normalizeCssUrl('https://static.example.com/css/custom.css')).toEqual({
      url: 'https://static.example.com/css/custom.css',
    })
    // 无路径时 URL 归一化会补上 /
    expect(normalizeCssUrl('http://example.com')).toEqual({ url: 'http://example.com/' })
    expect(normalizeCssUrl('  https://example.com/a.css  ')).toEqual({
      url: 'https://example.com/a.css',
    })
  })

  it('拒绝伪协议', () => {
    for (const value of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/css,body{}',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com/x.css',
      'blob:https://example.com/uuid',
    ]) {
      const result = normalizeCssUrl(value)
      expect('reason' in result, value).toBe(true)
    }
  })

  it('拒绝协议相对地址与相对路径', () => {
    // 协议相对会继承当前页协议，多域名部署下指向不可预期的主机
    expect('reason' in normalizeCssUrl('//evil.example/x.css')).toBe(true)
    expect('reason' in normalizeCssUrl('/css/custom.css')).toBe(true)
    expect('reason' in normalizeCssUrl('./custom.css')).toBe(true)
    expect('reason' in normalizeCssUrl('custom.css')).toBe(true)
  })

  it('拒绝空值、非字符串、超长与控制字符', () => {
    for (const value of ['', '   ', 'not a url', 42, null, undefined, {}]) {
      expect('reason' in normalizeCssUrl(value), String(value)).toBe(true)
    }
    expect('reason' in normalizeCssUrl(`https://example.com/${'a'.repeat(2100)}.css`)).toBe(true)
    expect('reason' in normalizeCssUrl('https://example.com/a\nb.css')).toBe(true)
    expect('reason' in normalizeCssUrl('https://example.com/a\u0000.css')).toBe(true)
  })

  it('拒绝缺少主机名的地址', () => {
    // `https://` / `https://?x` 这类没有主机的写法直接解析失败
    for (const value of ['http://', 'https://', 'https://?x.css', 'https://#f', 'https://@/x']) {
      expect('reason' in normalizeCssUrl(value), value).toBe(true)
    }
  })

  it('多个斜杠的写法按 WHATWG 规则归一化，与浏览器行为一致', () => {
    // `http:///x.css` 在浏览器里就是 `http://x.css/`（主机是 x.css），
    // 所以这里接受并返回归一化结果——与浏览器的解析保持一致，而不是另立规则。
    expect(normalizeCssUrl('http:///x.css')).toEqual({ url: 'http://x.css/' })
  })
})

describe('Theme：Custom CSS 列表', () => {
  it('保持配置顺序并归一化', () => {
    const { urls, rejected } = normalizeCustomCssList([
      'https://static.example.com/css/custom.css',
      'https://static.example.com/css/overrides.css',
    ])
    expect(urls).toEqual([
      'https://static.example.com/css/custom.css',
      'https://static.example.com/css/overrides.css',
    ])
    expect(rejected).toEqual([])
  })

  it('重复地址去重且保留首次出现的位置', () => {
    const { urls, rejected } = normalizeCustomCssList([
      'https://a.example/x.css',
      'https://b.example/y.css',
      'https://a.example/x.css',
    ])
    expect(urls).toEqual(['https://a.example/x.css', 'https://b.example/y.css'])
    expect(rejected.map((r) => r.reason)).toEqual(['重复地址'])
  })

  it('超过 8 条时截断，多余条目被记录但不生效', () => {
    const input = Array.from({ length: 10 }, (_, i) => `https://cdn.example/${i}.css`)
    const { urls, rejected } = normalizeCustomCssList(input)
    expect(urls).toHaveLength(CUSTOM_CSS_MAX_URLS)
    expect(CUSTOM_CSS_MAX_URLS).toBe(8)
    expect(urls[0]).toBe('https://cdn.example/0.css')
    expect(urls[7]).toBe('https://cdn.example/7.css')
    // 第 9、10 条都被记录为超限
    expect(rejected).toHaveLength(2)
    expect(rejected.every((r) => /上限/.test(r.reason))).toBe(true)
  })

  it('单条非法不影响其它合法条目', () => {
    const { urls, rejected } = normalizeCustomCssList([
      'https://ok.example/a.css',
      'javascript:alert(1)',
      '//evil.example/b.css',
      'https://ok.example/c.css',
      42,
    ])
    expect(urls).toEqual(['https://ok.example/a.css', 'https://ok.example/c.css'])
    expect(rejected).toHaveLength(3)
  })

  it('非数组输入返回空列表', () => {
    for (const value of [undefined, null, 'https://a.example/x.css', 42, {}]) {
      expect(normalizeCustomCssList(value).urls).toEqual([])
    }
  })

  it('空数组不产出任何地址', () => {
    expect(normalizeCustomCssList([]).urls).toEqual([])
  })

  it('全部非法时返回空列表', () => {
    const { urls } = normalizeCustomCssList(['javascript:1', 'data:text/css,x', '/rel.css'])
    expect(urls).toEqual([])
  })
})

describe('Theme：Custom CSS 解析入口', () => {
  it('数组配置被解析为 URL 列表', () => {
    const config = parseThemeConfig({
      custom: { css: ['https://a.example/x.css', 'https://b.example/y.css'] },
    })
    expect(config.custom.css).toEqual(['https://a.example/x.css', 'https://b.example/y.css'])
  })

  it('内联 CSS 字符串不再有效，降级为空列表', () => {
    // 旧语义（css: "..."）必须失效：字符串不是数组，直接跳过
    for (const value of ['.prose { color: red; }', '', '   ', null, 42]) {
      const config = parseThemeConfig({ custom: { css: value } })
      expect(config.custom.css, String(value)).toEqual([])
    }
  })

  it('缺省时是空数组而不是 null', () => {
    expect(parseThemeConfig({}).custom.css).toEqual([])
    expect(parseThemeConfig({ custom: {} }).custom.css).toEqual([])
    expect(DEFAULT_THEME_CONFIG.custom.css).toEqual([])
  })

  it('混合合法与非法条目时只保留合法项', () => {
    const config = parseThemeConfig({
      custom: {
        css: [
          'https://ok.example/a.css',
          'javascript:alert(1)',
          'https://ok.example/a.css',
          'https://ok.example/b.css',
        ],
      },
    })
    expect(config.custom.css).toEqual(['https://ok.example/a.css', 'https://ok.example/b.css'])
  })

  it('不产出 HTML / JS 执行入口', () => {
    // 配置里塞脚本或标签只会被判为非法 URL，从而完全不出现在结果里
    const config = parseThemeConfig({
      custom: {
        css: [
          '"><script>alert(1)</script>',
          'javascript:alert(1)',
          'data:text/css,body{display:none}',
        ],
        script: 'console.log(1)',
        js: ['https://evil.example/x.js'],
        style: 'body{display:none}',
      },
    })
    expect(config.custom.css).toEqual([])
    // 不认识的键不进入 ThemeCustom
    expect(Object.keys(config.custom)).toEqual(['css'])
  })

  it('配置里的未知 custom 子键被忽略', () => {
    const config = parseThemeConfig({ custom: { css: [], somethingElse: 'x' } })
    expect(config.custom).toEqual({ css: [] })
  })
})
