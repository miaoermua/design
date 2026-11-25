/**
 * 内容语言在页面调用点的落地
 *
 * 仓库层支持 `lang` 只是前提：页面不传，参数就永远不会出现在请求里。
 * 这组测试逐个页面钉住「取数时用的是当前 locale 映射出的内容语言」，
 * 因为这类遗漏不会报错，只会静默地渲染出另一种语言的标题与正文。
 *
 * 同时守住两条边界：
 *   - 详情页的 metadata 与正文必须用同一个 `?lang=`，否则标题与正文语言分叉；
 *   - RSS / sitemap 不跟随访客语言（`src/lib/i18n/server.ts` 已记录该取舍），
 *     它们是面向抓取器的全站产物，不该因 cookie 分裂缓存。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/** 去掉注释：本仓库注释会引用旧实现，全文断言会把说明当成代码 */
function readCode(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

describe('详情页：metadata 与正文用同一个内容语言', () => {
  const article = readCode('src/app/articles/[category]/[slug]/page.tsx')

  it('文章详情两次取数（metadata / 页面）都传 lang', () => {
    expect(article).toContain('const contentLang = toContentLang(locale)')
    expect(article).toContain('getArticle(category, slug, { lang: contentLang })')
    // 一处 metadata、一处正文
    expect(article.match(/getArticle\(category, slug, \{ lang: contentLang \}\)/g)).toHaveLength(2)
    // 没有留下不带语言的那次调用
    expect(article).not.toMatch(/getArticle\(category, slug\)/)
  })

  it('日记详情按 nid 取数时把 lang 与 password 一起传', () => {
    const note = readCode('src/app/notes/[nid]/page.tsx')
    expect(note).toContain('getDiaryByNid(Number(nid), password, { lang: contentLang })')
    expect(
      note.match(/getDiaryByNid\(Number\(nid\), password, \{ lang: contentLang \}\)/g),
    ).toHaveLength(2)
    expect(note).not.toMatch(/getDiaryByNid\(Number\(nid\), password\)/)
  })

  it('旧详情路由同样带语言，密码分支没有丢', () => {
    const legacy = readCode('src/app/diaries/[id]/page.tsx')
    expect(legacy).toContain('getDiary(id, password, { lang: toContentLang(locale) })')
    expect(legacy).toContain('isPasswordRequired')
    expect(legacy).toContain('<PasswordGate')
  })
})

describe('列表与扫描路径', () => {
  it('文章列表', () => {
    expect(readCode('src/app/articles/page.tsx')).toContain('lang: toContentLang(locale)')
  })

  it('分类页的文章分页', () => {
    const code = readCode('src/app/categories/[slug]/page.tsx')
    expect(code).toContain('categoryIds: [category.id]')
    expect(code).toContain('lang: toContentLang(locale)')
  })

  it('标签页（多页扫描）', () => {
    expect(readCode('src/app/tags/[tag]/page.tsx')).toContain('lang: toContentLang(locale)')
  })

  it('日记入口的最新一篇扫描', () => {
    expect(readCode('src/app/notes/page.tsx')).toContain(
      'getLatestDiary({ lang: toContentLang(locale) })',
    )
  })

  it('日记时间线的「全部」与「专栏」两条取数都带语言', () => {
    const code = readCode('src/app/notes/list/page.tsx')
    expect(code.match(/lang: toContentLang\(locale\)/g)).toHaveLength(2)
    expect(code).toContain('listDiariesByTopic(topic.id, {')
    expect(code).toContain('listDiaries({')
  })

  it('搜索结果页与 /api/search 面板一致', () => {
    expect(readCode('src/app/search/page.tsx')).toContain('lang: toContentLang(locale)')
    expect(readCode('src/app/api/search/route.ts')).toContain('lang: toContentLang(locale)')
  })

  it('探索页的时间线（只回标题，但标题也是内容）', () => {
    expect(readCode('src/app/explore/page.tsx')).toContain(
      'getTimeline({ lang: toContentLang(locale) })',
    )
  })

  it('首页保持既有实现（本来就传了 lang）', () => {
    const home = readCode('src/app/page.tsx')
    expect(home).toContain('const lang = toContentLang(locale)')
    expect(home).toContain('lang,')
  })
})

describe('全站产物不跟随访客语言', () => {
  it('RSS 与 sitemap 不引入内容语言参数', () => {
    // 它们是给抓取器/订阅器看的，没有「读者当前界面语言」；按 cookie 变化会让缓存分裂
    expect(readCode('src/app/feed.xml/route.ts')).not.toContain('toContentLang')
    expect(readCode('src/app/sitemap.ts')).not.toContain('toContentLang')
  })
})
