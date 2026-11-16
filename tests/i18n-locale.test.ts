/**
 * 语言标签归一化、Accept-Language 协商与字典完整性
 *
 * 界面只有两种语言：简体中文与英文。这个文件钉住三条：
 *   1. `zh` 及其**任意**地区/脚本变体（TW / HK / MO / SG / Hant …）都归为 `zh-CN`——
 *      不做繁简区分，也不允许由此产生第三个 locale；
 *   2. 非中文一律归 `en`，且按**首选语言**判断，不是「列表里出现中文就切中文」；
 *   3. 自动识别的兜底是英文，且它永远不会覆盖已存在的手动选择（cookie）。
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  detectLocale,
  isLocale,
  localeLabel,
  localeName,
  negotiateLocale,
  normalizeLocale,
  parseLocaleCookie,
  toContentLang,
  toOgLocale,
} from '@/lib/i18n/config'
import { dictionary, t, tf } from '@/lib/i18n/dictionary'

describe('normalizeLocale：中文不分简繁，一律简体', () => {
  it.each([
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-MY', 'zh-CN'],
    // 繁体地区与繁体脚本：站点只有一套简体界面，不做繁简转换
    ['zh-TW', 'zh-CN'],
    ['zh-HK', 'zh-CN'],
    ['zh-MO', 'zh-CN'],
    ['zh-Hant', 'zh-CN'],
    ['zh-Hant-TW', 'zh-CN'],
    ['zh-Hant-HK', 'zh-CN'],
    // 简体脚本与「脚本 + 地区」组合
    ['zh-Hans', 'zh-CN'],
    ['zh-Hans-CN', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLocale(input)).toBe(expected)
  })

  it('大小写、下划线与首尾空格都能识别', () => {
    expect(normalizeLocale('ZH-tw')).toBe('zh-CN')
    expect(normalizeLocale('zh_TW')).toBe('zh-CN')
    expect(normalizeLocale('  zh-HK  ')).toBe('zh-CN')
  })

  it('其他语言一律归英文，不产生第三种 locale', () => {
    for (const tag of ['en', 'en-US', 'en-GB', 'ja', 'ja-JP', 'ko-KR', 'fr', 'de-DE', 'ru']) {
      expect(normalizeLocale(tag)).toBe('en')
    }
  })

  it('无法识别的标签返回 null，交给协商逻辑跳过', () => {
    for (const tag of ['', '   ', '*', '123', 'x-private', '-', null, undefined]) {
      expect(normalizeLocale(tag as string)).toBeNull()
    }
  })

  it('残缺但主语言可读的标签按主语言处理，不当作无语言', () => {
    // `zh-` 这种带尾随连字符的写法严格说不合法，但主语言明确是中文，
    // 把它判成「没有语言」只会让用户白掉回兜底语言，不如按简体处理。
    expect(normalizeLocale('zh-')).toBe('zh-CN')
    expect(normalizeLocale('en-')).toBe('en')
  })
})

describe('detectLocale：兜底是英文', () => {
  it('没有 header、空 header、只有 `*` 时都落英文', () => {
    for (const header of ['', '   ', '*', null, undefined]) {
      expect(detectLocale(header as string)).toBe('en')
    }
  })

  it('全是无效标签时也落英文，而不是中文', () => {
    expect(detectLocale('123, x-private')).toBe('en')
  })

  it('永远不会返回两种语言之外的值', () => {
    const headers = ['zh-Hant-HK', 'ja-JP', 'ko-KR', 'fr-CA', '', '*', 'en-GB']
    for (const header of headers) {
      expect(['zh-CN', 'en']).toContain(detectLocale(header))
    }
  })

  it('兜底常量就是英文，基准语言仍然是简体', () => {
    expect(FALLBACK_LOCALE).toBe('en')
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    // 两者刻意不是同一个值：前者决定界面兜底，后者决定内容取数参数
    expect(FALLBACK_LOCALE).not.toBe(DEFAULT_LOCALE)
  })
})

describe('parseLocaleCookie', () => {
  it('两个受支持的取值直接通过', () => {
    for (const locale of LOCALES) expect(parseLocaleCookie(locale)).toBe(locale)
  })

  it('旧版的 zh / zh-TW / zh-HK / zh-Hant 都归为简体，不重置老用户的选择', () => {
    for (const legacy of ['zh', ' ZH ', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-HK']) {
      expect(parseLocaleCookie(legacy)).toBe('zh-CN')
    }
  })

  it('非中文的非法值返回 null，交给浏览器协商', () => {
    for (const value of ['en-US', 'ja', 'tw', '', undefined, null, 42, {}]) {
      expect(parseLocaleCookie(value as string)).toBeNull()
    }
  })

  it('cookie 名与主题存储键互不冲突', () => {
    expect(LOCALE_COOKIE).toBe('folio-lang')
    expect(LOCALE_COOKIE).not.toBe('folio-theme')
  })
})

describe('negotiateLocale：q 权重与首选语言', () => {
  it('按首选语言判断，不扫描「列表里有没有中文」', () => {
    // 用户把日语放第一位：即便第二语言是中文，也必须是英文
    expect(negotiateLocale('ja-JP, zh-CN')).toBe('en')
    expect(negotiateLocale('ja-JP,zh-CN;q=0.9')).toBe('en')
    expect(negotiateLocale('ko-KR, zh-CN;q=0.8')).toBe('en')
    // 反过来把中文放第一位，就是中文
    expect(negotiateLocale('zh-CN, ja-JP')).toBe('zh-CN')
  })

  it('读完整条 header，按 q 降序取最高权重', () => {
    expect(negotiateLocale('en-US,en;q=0.9,zh-CN;q=0.8')).toBe('en')
    expect(negotiateLocale('zh-CN;q=0.8,en;q=0.9')).toBe('en')
    expect(negotiateLocale('en;q=0.5,zh-CN;q=0.9')).toBe('zh-CN')
  })

  it('同权重保持声明顺序', () => {
    expect(negotiateLocale('en, zh-CN')).toBe('en')
    expect(negotiateLocale('zh-CN, en')).toBe('zh-CN')
    expect(negotiateLocale('ja, ko, zh-CN')).toBe('en')
  })

  it('未写 q 视为 1', () => {
    expect(negotiateLocale('zh-TW, en;q=0.9')).toBe('zh-CN')
  })

  it('q=0 表示明确拒绝，该条目被跳过', () => {
    expect(negotiateLocale('zh;q=0, en;q=0.5')).toBe('en')
    expect(negotiateLocale('en;q=0')).toBeNull()
  })

  it('无效 q 值只丢掉该条目，不影响其他条目', () => {
    expect(negotiateLocale('zh;q=abc, en;q=0.5')).toBe('en')
    expect(negotiateLocale('zh;q=2, en;q=0.5')).toBe('en')
    expect(negotiateLocale('zh;q=1.5, en;q=0.5')).toBe('en')
  })

  it('无效标签被跳过', () => {
    expect(negotiateLocale('123, x-private, zh-HK')).toBe('zh-CN')
  })

  it('`*` 不产生匹配', () => {
    expect(negotiateLocale('*')).toBeNull()
    expect(negotiateLocale('*, zh-TW;q=0.8')).toBe('zh-CN')
  })

  it('空 header / 无 header 返回 null，由 detectLocale 兜底', () => {
    for (const header of ['', '  ', null, undefined]) {
      expect(negotiateLocale(header as string)).toBeNull()
    }
  })

  it('多余空格与空条目不影响解析', () => {
    expect(negotiateLocale('  zh-TW ; q=0.9 ,, en ; q=0.8 ')).toBe('zh-CN')
  })

  it('真实浏览器典型值', () => {
    expect(negotiateLocale('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh-CN')
    expect(negotiateLocale('zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('zh-CN')
    expect(negotiateLocale('en-US,en;q=0.9')).toBe('en')
    expect(negotiateLocale('ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('en')
    expect(negotiateLocale('de-DE,de;q=0.9,en;q=0.8')).toBe('en')
  })
})

describe('toContentLang / toOgLocale', () => {
  it('默认语言不传给后端，避免把原文再翻一次', () => {
    expect(toContentLang(DEFAULT_LOCALE)).toBeUndefined()
    expect(toContentLang('en')).toBe('en')
  })

  it('OpenGraph 用下划线形式，与 <html lang> 的 BCP 47 不同', () => {
    expect(toOgLocale('zh-CN')).toBe('zh_CN')
    expect(toOgLocale('en')).toBe('en_US')
  })

  it('工具条短标识与全名都是两项且互不相同', () => {
    const labels = LOCALES.map((locale) => localeLabel(locale))
    const names = LOCALES.map((locale) => localeName(locale))
    expect(labels).toEqual(['中', 'EN'])
    expect(names).toEqual(['中文', 'English'])
    expect(new Set(labels).size).toBe(2)
    expect(new Set(names).size).toBe(2)
  })

  it('isLocale 只认两个受支持的值', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
    for (const value of ['zh', 'zh-TW', 'en-US', 'ZH-CN', '', null, 42]) {
      expect(isLocale(value)).toBe(false)
    }
  })
})

/** 取出文案里的 `{name}` 占位符，用于跨语言比对 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()
}

const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/

describe('字典：两种语言必须同构', () => {
  const zhCN = dictionary('zh-CN')
  const en = dictionary('en')

  it('LOCALES 只有两项，不会再有第三个 locale', () => {
    expect(LOCALES).toEqual(['zh-CN', 'en'])
    expect(LOCALES).toHaveLength(2)
  })

  it('键集合完全一致，不会有某种语言缺一条', () => {
    const keys = Object.keys(zhCN).sort()
    expect(keys.length).toBeGreaterThan(200)
    expect(Object.keys(en).sort()).toEqual(keys)
  })

  it('没有空文案，也没有把 key 当文案', () => {
    for (const [locale, dict] of [
      ['zh-CN', zhCN],
      ['en', en],
    ] as const) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${locale} ${key}`).not.toBe('')
        expect(value, `${locale} ${key}`).not.toBe(key)
      }
    }
  })

  it('同一 key 的占位符在两种语言里一致', () => {
    for (const key of Object.keys(zhCN) as Array<keyof typeof zhCN>) {
      const expected = placeholders(zhCN[key])
      expect(placeholders(en[key]), `en ${key}`).toEqual(expected)
    }
  })

  it('英文模式不残留中文', () => {
    const offenders = Object.entries(en)
      .filter(([, value]) => CJK.test(value))
      .map(([key, value]) => `${key}: ${value}`)
    expect(offenders).toEqual([])
  })

  it('中文侧只保留简体一套', () => {
    expect(t('zh-CN', 'action.search')).toBe('搜索')
    expect(t('en', 'action.search')).toBe('Search')
  })

  it('t 遇到未知语言回退简体，而不是抛错或返回空串', () => {
    // 繁中已不是受支持的语言：任何残留调用都必须安全回退
    expect(t('zh-TW' as never, 'nav.home')).toBe(t('zh-CN', 'nav.home'))
    expect(t('zh-CN', 'nav.home').length).toBeGreaterThan(0)
  })

  it('tf 替换所有占位符，缺变量时保留原样而不是 undefined', () => {
    expect(tf('zh-CN', 'status.attempt', { base: '基', count: 3 })).toContain('3')
    expect(tf('zh-CN', 'status.attempt', { base: '基' })).not.toContain('undefined')
  })
})
