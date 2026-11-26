/**
 * 密码处理：跟随上游，不做自定义机制
 *
 * 这组测试的作用与普通回归测试不同——它**锁定一个决定**：
 * 密码走 `?password=` 查询参数，与 Shiro / Kami 一致，不引入 POST 中转、
 * cookie 凭据或签名令牌。
 *
 * 上游依据（读过源码）：
 *   - Shiro `apps/web/src/components/modules/note/NotePasswordForm.tsx`
 *       `searchParams.set('password', password)` → 跳转
 *   - Shiro `apps/web/src/providers/note/CurrentNoteDataProvider.tsx`
 *       `useSearchParams().get('password')` → `queries.note.byNid(nid, password)`
 *   - Kami `src/pages/[locale]/notes/[id].tsx`
 *       `ctx.query.password` → `noteCollection.fetchById(id, password)`
 *   - core `packages/api-client/controllers/note.ts`
 *       `NoteByNidOptions.password` 作为 `params.password` 发给
 *       `GET /notes/nid/:nid`
 *
 * 也就是说：**上游把密码放在 URL 里**。我们沿用同一套参数，只是把请求放在
 * 服务端做（本主题不让浏览器直连后端）。
 *
 * 如果将来要改成 cookie / POST，先确认上游是否改了契约；不要只在本主题里
 * 单方面加固——那会让行为与整个 MX 生态不一致。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/** 去掉注释：本仓库注释会引用旧实现，直接全文断言会把说明当成代码 */
function readCode(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

describe('密码参数与上游同形', () => {
  const gate = readCode('src/features/diaries/components/password-gate.tsx')

  it('表单用 GET，把 password 拼成查询参数', () => {
    expect(gate).toContain('method="get"')
    expect(gate).toContain('name="password"')
    expect(gate).toContain('type="password"')
  })

  it('没有自建解锁接口或 cookie 凭据', () => {
    // 这些是上游不存在的东西，移除后不应回来
    expect(gate).not.toContain('/api/notes/unlock')
    expect(gate).not.toContain('method="post"')
  })

  it('两个页面都从 searchParams 读 password', () => {
    for (const path of ['src/app/notes/[nid]/page.tsx', 'src/app/diaries/[id]/page.tsx']) {
      const code = readCode(path)
      expect(code).toContain('password?: string')
      expect(code).toContain('searchParams')
      // 直接透传给 repository → 上游 query
      expect(code).toMatch(/password\s*\)/)
    }
  })

  it('密码透传到上游，由 repository 组进查询参数', () => {
    const repo = read('src/lib/api/repositories/notes.ts')
    // 两个入口都支持 password，且都走 query。语言参数是后来加的，
    // 只能追加在密码之后，不能把 `password` 从查询串里挤掉。
    expect(repo).toMatch(/getDiary\([\s\S]*?password\?: string/)
    expect(repo).toMatch(/getDiaryByNid\(\s*nid: number,\s*password\?: string/)
    expect(repo.match(/query: \{ password, lang: options\.lang \}/g)).toHaveLength(2)
    expect(repo).toContain('query: { password')
  })

  it('不存在解锁专用的 API 路由', () => {
    expect(() => read('src/app/api/notes/unlock/route.ts')).toThrow()
  })
})

describe('密码不进错误信息', () => {
  it('网络错误只保留 origin + path', () => {
    const http = read('src/lib/api/client/http.ts')
    expect(http).toContain('redactUrl')
    // 曾经是 `请求失败：GET ${url}`
    expect(readCode('src/lib/api/client/http.ts')).not.toMatch(/请求失败：GET \$\{url\}/)
    expect(readCode('src/lib/api/client/http.ts')).not.toMatch(/请求失败：POST \$\{url\}/)
  })
})

describe('受保护日记与公开列表的边界', () => {
  it('密码门是唯一入口，不泄露正文', () => {
    const site = readCode('src/app/notes/[nid]/page.tsx')
    // 403 分支直接 return 密码门，不继续往下渲染正文
    expect(site).toContain('isPasswordRequired')
    expect(site).toContain('<PasswordGate')
  })

  it('旧路由也处理受保护日记，不抛未捕获异常', () => {
    const legacy = readCode('src/app/diaries/[id]/page.tsx')
    expect(legacy).toContain('isPasswordRequired')
    expect(legacy).toContain('<PasswordGate')
    // 308 的目标不含密码
    expect(legacy).toContain('permanentRedirect(notePath(diary.nid))')
  })
})
