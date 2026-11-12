import { describe, expect, it } from 'vitest'

import {
  DONATE_DEFAULT_LABEL,
  DONATE_MAX_QRCODES,
  DONATE_NAME_MAX,
  hasDonate,
  parseDonateQrcodes,
  readDonateConfig,
  safeQrcodeUrl,
} from '@/features/donate/config'

const qr = (name: string, url: string) => ({ name, url })

describe('readDonateConfig', () => {
  it('配置缺失时退化为「关闭 + 默认文案 + 空列表」', () => {
    for (const input of [undefined, null, 42, 'x', [], {}]) {
      const config = readDonateConfig(input)
      expect(config.enabled).toBe(false)
      expect(config.label).toBe(DONATE_DEFAULT_LABEL)
      expect(config.qrcodes).toEqual([])
      expect(hasDonate(input)).toBe(false)
    }
  })

  it('读取 enabled / label / qrcode 并按配置顺序保留', () => {
    const theme = {
      donate: {
        enabled: true,
        label: '请我喝咖啡',
        qrcode: [
          qr('微信', 'https://static.example.com/wechat.webp'),
          qr('支付宝', 'https://static.example.com/alipay.webp'),
        ],
      },
    }

    const config = readDonateConfig(theme)
    expect(config.enabled).toBe(true)
    expect(config.label).toBe('请我喝咖啡')
    expect(config.qrcodes.map((item) => item.name)).toEqual(['微信', '支付宝'])
    expect(config.qrcodes.map((item) => item.url)).toEqual([
      'https://static.example.com/wechat.webp',
      'https://static.example.com/alipay.webp',
    ])
    expect(hasDonate(theme)).toBe(true)
  })

  it('enabled=false 时不显示入口（即使二维码完整）', () => {
    const theme = { donate: { enabled: false, qrcode: [qr('微信', 'https://a.example/q.png')] } }
    expect(readDonateConfig(theme).qrcodes).toHaveLength(1)
    expect(hasDonate(theme)).toBe(false)
  })

  it('enabled=true 但没有二维码时不显示入口', () => {
    expect(hasDonate({ donate: { enabled: true } })).toBe(false)
    expect(hasDonate({ donate: { enabled: true, qrcode: [] } })).toBe(false)
    expect(hasDonate({ donate: { enabled: true, qrcode: 'https://a.example/q.png' } })).toBe(false)
  })

  it('label 只接受非空字符串，过长按上限截断', () => {
    expect(readDonateConfig({ donate: { label: '   ' } }).label).toBe(DONATE_DEFAULT_LABEL)
    expect(readDonateConfig({ donate: { label: 123 } }).label).toBe(DONATE_DEFAULT_LABEL)
    expect(readDonateConfig({ donate: { label: '  打 赏  ' } }).label).toBe('打 赏')
    expect(readDonateConfig({ donate: { label: '赏'.repeat(40) } }).label).toHaveLength(16)
  })
})

describe('二维码 URL 校验', () => {
  it('接受 http(s) 绝对地址，并去掉首尾空白', () => {
    expect(safeQrcodeUrl('https://static.example.com/a.png')).toBe(
      'https://static.example.com/a.png',
    )
    expect(safeQrcodeUrl('  http://cdn.example.com/a.png  ')).toBe('http://cdn.example.com/a.png')
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/svg+xml,<svg onload="alert(1)"/>'],
    ['协议相对', '//static.example.com/a.png'],
    ['ftp:', 'ftp://example.com/a.png'],
    ['非 URL', 'not a url'],
    ['空字符串', '   '],
    ['对象', { href: 'https://a.example/q.png' }],
  ])('拒绝 %s', (_case, value) => {
    expect(safeQrcodeUrl(value)).toBeNull()
  })

  it('非法条目按条忽略，不影响其余二维码', () => {
    const items = parseDonateQrcodes([
      qr('坏的', 'javascript:alert(1)'),
      qr('微信', 'https://a.example/wechat.png'),
      qr('也坏', '//a.example/x.png'),
      qr('支付宝', 'https://a.example/alipay.png'),
    ])

    expect(items).toEqual([
      { name: '微信', url: 'https://a.example/wechat.png' },
      { name: '支付宝', url: 'https://a.example/alipay.png' },
    ])
  })

  it('全部非法时得到空列表（入口随之隐藏）', () => {
    const theme = {
      donate: { enabled: true, qrcode: [qr('a', 'javascript:alert(1)'), qr('b', '/relative.png')] },
    }
    expect(readDonateConfig(theme).qrcodes).toEqual([])
    expect(hasDonate(theme)).toBe(false)
  })

  it('缺失名称时用序号兜底，过长名称截断', () => {
    const items = parseDonateQrcodes([
      { url: 'https://a.example/1.png' },
      { name: '   ', url: 'https://a.example/2.png' },
      { name: '长'.repeat(40), url: 'https://a.example/3.png' },
    ])

    expect(items[0]?.name).toBe('二维码 1')
    expect(items[1]?.name).toBe('二维码 2')
    expect(items[2]?.name).toHaveLength(DONATE_NAME_MAX)
  })

  it('同一 URL 配两次只保留第一条', () => {
    const items = parseDonateQrcodes([
      qr('微信', 'https://a.example/q.png'),
      qr('重复', 'https://a.example/q.png'),
    ])
    expect(items).toHaveLength(1)
    expect(items[0]?.name).toBe('微信')
  })

  it(`最多保留 ${DONATE_MAX_QRCODES} 张`, () => {
    const items = parseDonateQrcodes(
      Array.from({ length: 10 }, (_, index) => qr(`q${index}`, `https://a.example/${index}.png`)),
    )
    expect(items).toHaveLength(DONATE_MAX_QRCODES)
    expect(items.at(-1)?.name).toBe(`q${DONATE_MAX_QRCODES - 1}`)
  })
})
