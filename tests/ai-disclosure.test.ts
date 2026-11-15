import { describe, expect, it } from 'vitest'
import { readAiDisclosure } from '@/lib/api/adapters/disclosure'
import { isEmptyDisclosure } from '@/lib/api/domain/disclosure'

/**
 * AI 参与声明解析
 *
 * core 的 `aiGen` 是**复选框组**（`MetaFieldType.Checkbox` + `allowCustomOption`），
 * 所以线上同时存在标量与数组两种形态；`post.repository.ts` 的
 * `jsonb @> '2'::jsonb` 过滤也是为这两种形态写的。这组断言把这层兼容性钉住。
 */
describe('readAiDisclosure：AI 参与声明', () => {
  it('标量形态（早期单选写法）', () => {
    expect(readAiDisclosure({ aiGen: 2 })).toEqual({ levels: [2], custom: [] })
  })

  it('数组形态（复选框组）', () => {
    expect(readAiDisclosure({ aiGen: [0, 8] })).toEqual({ levels: [0, 8], custom: [] })
  })

  it('等级升序去重：-1 排在 0 前面', () => {
    expect(readAiDisclosure({ aiGen: [8, 0, 8, -1] })?.levels).toEqual([-1, 0, 8])
  })

  it('数字被序列化成字符串时仍然认得出', () => {
    expect(readAiDisclosure({ aiGen: ['1', '5'] })).toEqual({ levels: [1, 5], custom: [] })
  })

  it('自定义选项原样保留（allowCustomOption）', () => {
    const disclosure = readAiDisclosure({ aiGen: [0, '翻译', '配图'] })
    expect(disclosure?.levels).toEqual([0])
    expect(disclosure?.custom).toEqual(['翻译', '配图'])
  })

  it('超出内置预设的数值视为自定义项，不丢信息', () => {
    const disclosure = readAiDisclosure({ aiGen: [42] })
    expect(disclosure?.levels).toEqual([])
    expect(disclosure?.custom).toEqual(['42'])
  })

  it('没有声明时返回 null：不等于「纯人工」', () => {
    expect(readAiDisclosure(null)).toBeNull()
    expect(readAiDisclosure({})).toBeNull()
    expect(readAiDisclosure({ aiGen: null })).toBeNull()
    expect(readAiDisclosure({ aiGen: [] })).toBeNull()
    expect(readAiDisclosure({ aiGen: '' })).toBeNull()
    expect(readAiDisclosure({ aiGen: '   ' })).toBeNull()
  })

  it('meta 不是对象时不受影响', () => {
    expect(readAiDisclosure(undefined)).toBeNull()
    expect(readAiDisclosure('meta')).toBeNull()
    expect(readAiDisclosure([1, 2])).toBeNull()
  })

  it('其它 meta 字段不干扰', () => {
    expect(
      readAiDisclosure({ cover: 'https://x/y.webp', keywords: ['a'], aiGen: [1] })?.levels,
    ).toEqual([1])
  })
})

describe('isEmptyDisclosure', () => {
  it('null 与空声明都算空', () => {
    expect(isEmptyDisclosure(null)).toBe(true)
    expect(isEmptyDisclosure({ levels: [], custom: [] })).toBe(true)
  })

  it('有任何一项就不算空', () => {
    expect(isEmptyDisclosure({ levels: [-1], custom: [] })).toBe(false)
    expect(isEmptyDisclosure({ levels: [], custom: ['翻译'] })).toBe(false)
  })
})
