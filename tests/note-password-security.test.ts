/**
 * 密码安全专项：密码不得进入浏览器地址栏、重定向地址与日志
 *
 * 背景：上游 core 的密码接口是 `GET /notes/:id?password=`（`NotePasswordQueryDto`），
 * 密码只能走查询参数。若让浏览器直接带 `?password=` 请求页面，密码会同时留在
 * 地址栏、浏览器历史、`Referer` 与服务器访问日志里。
 *
 * 因此浏览器侧改为 POST 提交 → 服务端换 httpOnly cookie → 303 到干净地址。
 * 上游契约不变，改动只发生在「浏览器怎么把密码交给我们的服务端」这一层。
 *
 * 这一组测试守的是**传输路径**，不是加密强度：断言密码不出现在任何 URL 上。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { redactUrl } from '@/lib/api/client/http'
import {
  decodePassword,
  encodePassword,
  legacyPasswordCookieName,
  MAX_PASSWORD_LENGTH,
  notePasswordCookieOptions,
  passwordCookieName,
} from '@/features/diaries/note-password'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/**
 * 去掉注释后的源码。
 *
 * 断言「某段写法不存在」时必须先剥注释：本仓库的注释大量引用旧实现
 * （例如解释为什么不能再用 `method="get"`、为什么要 303 而非 308），
 * 直接对全文断言会把说明文字当成违规代码。
 */
function readCode(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

/* ── 表单：必须 POST，且不拼查询串 ─────────────────────────────── */

describe('密码门的提交方式', () => {
  const gate = readCode('src/features/diaries/components/password-gate.tsx')

  it('用 POST 提交到解锁路由', () => {
    expect(gate).toContain('method="post"')
    expect(gate).toContain('action="/api/notes/unlock"')
  })

  it('绝不使用 GET：那会把密码拼进 ?password=', () => {
    expect(gate).not.toContain('method="get"')
    expect(gate).not.toContain('?password=')
  })

  it('目标 id 用隐藏字段传，不作为表单 action 的查询串', () => {
    expect(gate).toContain('type="hidden"')
    expect(gate).toContain('name={target.field}')
    // 输入框仍是密码类型；自动填充语义用 current-password
    expect(gate).toContain('type="password"')
    expect(gate).toContain('autoComplete="current-password"')
  })

  it('两条路由共用同一个密码门组件', () => {
    const detail = read('src/app/notes/[nid]/page.tsx')
    const legacy = read('src/app/diaries/[id]/page.tsx')
    for (const source of [detail, legacy]) {
      expect(source).toContain("from '@/features/diaries/components/password-gate'")
      expect(source).toContain('<PasswordGate')
    }
    // 页面里不再各自内联一份表单
    expect(readCode('src/app/notes/[nid]/page.tsx')).not.toContain('name="password"')
    expect(readCode('src/app/diaries/[id]/page.tsx')).not.toContain('name="password"')
  })
})

/* ── 页面：密码不从 URL 读 ──────────────────────────────────────── */

describe('页面不再从 URL 取密码', () => {
  const detail = read('src/app/notes/[nid]/page.tsx')
  const legacy = read('src/app/diaries/[id]/page.tsx')
  const legacyCode = readCode('src/app/diaries/[id]/page.tsx')

  it('searchParams 里只有 wrong，没有 password', () => {
    expect(detail).toContain('{ wrong?: string }')
    expect(legacy).toContain('{ wrong?: string }')
    expect(detail).not.toMatch(/searchParams:\s*Promise<\{[^}]*password/)
    expect(legacy).not.toMatch(/searchParams:\s*Promise<\{[^}]*password/)
  })

  it('密码来自 httpOnly cookie', () => {
    expect(detail).toContain('readNotePassword')
    expect(legacy).toContain('readLegacyNotePassword')
  })

  it('旧路由的 308 目标不含密码', () => {
    // 曾经是 `${notePath(diary.nid)}?password=${encodeURIComponent(password)}`
    expect(legacyCode).toContain('permanentRedirect(notePath(diary.nid))')
    expect(legacyCode).not.toContain('?password=')
  })

  it('全仓没有把密码拼进 URL 的写法', () => {
    for (const path of [
      'src/app/notes/page.tsx',
      'src/app/notes/list/page.tsx',
      'src/app/notes/[nid]/page.tsx',
      'src/app/diaries/page.tsx',
      'src/app/diaries/[id]/page.tsx',
      'src/app/api/notes/unlock/route.ts',
    ]) {
      expect(readCode(path)).not.toContain('password=${')
    }
  })
})

/* ── 解锁路由：cookie 与回跳 ───────────────────────────────────── */

describe('POST /api/notes/unlock', () => {
  const route = readCode('src/app/api/notes/unlock/route.ts')

  it('成功时写 httpOnly cookie 并 303 到干净地址', () => {
    expect(route).toContain('response.cookies.set')
    expect(route).toContain('notePasswordCookieOptions')
    expect(route).toContain('NextResponse.redirect')
    expect(route).toContain('303')
    // 303 是表单 POST 之后的正确语义：308 会保留方法、把密码再 POST 一遍
    expect(route).not.toContain('308')
  })

  it('回跳地址由服务端按校验过的数字拼出，不采信外部 return 参数', () => {
    expect(route).not.toContain('form.get(\'return\')')
    expect(route).not.toContain('form.get("return")')
    expect(route).toContain('failurePath(target)')
  })

  it('cookie 选项：httpOnly / 同站 / 有有效期', () => {
    const options = notePasswordCookieOptions()
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
    expect(options.maxAge).toBeGreaterThan(0)
  })

  it('按 nid 与雪花 id 双写，两条路由都能读到', () => {
    expect(route).toContain('passwordCookieName(diary.nid)')
    expect(route).toContain('legacyPasswordCookieName(diary.id)')
    expect(passwordCookieName(13)).toBe('folio-note-pw-13')
    expect(legacyPasswordCookieName('188522778012422144')).toBe(
      'folio-note-pw-id-188522778012422144',
    )
  })

  it('日记不存在时给 404，而不是伪装成密码错误', () => {
    expect(route).toContain('isNotFound')
    expect(route).toContain('status: 404')
  })
})

/* ── 凭据编码 ──────────────────────────────────────────────────── */

describe('cookie 值的编码与边界', () => {
  it('往返可还原，包括中文与特殊字符', () => {
    for (const password of ['hunter2', '密码123', 'a b;c,d"e', '🎉 emoji']) {
      expect(decodePassword(encodePassword(password))).toBe(password)
    }
  })

  it('编码结果只含 cookie 安全的字符', () => {
    const encoded = encodePassword('a b;c,d"e\\f')
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('空值与超长值一律当作没有凭据', () => {
    expect(decodePassword(undefined)).toBeNull()
    expect(decodePassword('')).toBeNull()
    const tooLong = 'x'.repeat(MAX_PASSWORD_LENGTH + 1)
    expect(decodePassword(encodePassword(tooLong))).toBeNull()
  })
})

/* ── 日志脱敏 ──────────────────────────────────────────────────── */

describe('错误信息里的 URL 脱敏', () => {
  it('去掉查询串与片段', () => {
    expect(redactUrl('https://api.example.com/api/v2/notes/13?password=hunter2')).toBe(
      'https://api.example.com/api/v2/notes/13',
    )
    expect(redactUrl('https://api.example.com/x?password=1#frag')).toBe(
      'https://api.example.com/x',
    )
  })

  it('没有查询串时原样返回', () => {
    expect(redactUrl('https://api.example.com/api/v2/notes/13')).toBe(
      'https://api.example.com/api/v2/notes/13',
    )
  })

  it('NetworkError 的消息用的是脱敏地址', () => {
    const http = readCode('src/lib/api/client/http.ts')
    // 曾经的写法是 `请求失败：GET ${url}`
    expect(http).not.toContain('请求失败：GET ${url}')
    expect(http).not.toContain('请求失败：POST ${url}')
    expect(http).toContain('请求失败：GET ${redactUrl(url)}')
  })
})

/* ── 解锁路由的行为（成功 / 失败 / 不存在） ────────────────────── */

describe('POST /api/notes/unlock 的三条分支', () => {
  /** 上游单篇日记的形状（`/notes/nid/:nid` 外面还包一层 `data`） */
  const NOTE = {
    data: {
      id: '188522778012422144',
      nid: 27,
      title: '受保护的日记',
      slug: 'private-note',
      text: '',
      content: '',
      content_format: 'markdown',
      is_published: true,
      has_password: true,
      public_at: '2026-10-11T09:00:00.000Z',
      created_at: '2026-10-11T09:00:00.000Z',
    },
  }

  /**
   * 起一个假上游：密码正确返回正文，错误返回 core 的 403 / code 14000。
   * 顺带记录每次请求的 URL，用来断言**密码确实以查询参数发给上游**
   * （那是既有契约，允许；不允许的是密码出现在浏览器那一侧）。
   */
  function stubUpstream(password: string) {
    const urls: string[] = []
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input : new URL(String(input))
      urls.push(url.toString())
      const given = url.searchParams.get('password')
      if (given !== password) {
        return new Response(JSON.stringify({ ok: 0, code: 14000, message: '该日记受密码保护' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(NOTE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch)
    return urls
  }

  function form(fields: Record<string, string>) {
    const body = new URLSearchParams(fields)
    return new Request('http://localhost:3000/api/notes/unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async function unlock(fields: Record<string, string>) {
    const { POST } = await import('@/app/api/notes/unlock/route')
    return POST(form(fields))
  }

  beforeEach(() => {
    process.env.MX_SERVER_URL = 'https://api.example.com'
    delete process.env.MX_MOCK
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('密码正确：303 到干净地址，并种下 httpOnly cookie', async () => {
    const urls = stubUpstream('secret123')
    const response = await unlock({ nid: '27', password: 'secret123' })

    expect(response.status).toBe(303)

    // 重定向地址里没有密码——这是本轮的核心要求
    const location = response.headers.get('location') ?? ''
    expect(location).toMatch(/\/notes\/27$/)
    expect(location).not.toContain('secret123')
    expect(location).not.toContain('password')

    // cookie 是 httpOnly，且值不是明文密码
    const cookies = response.headers.getSetCookie()
    expect(cookies.length).toBeGreaterThanOrEqual(2)
    for (const cookie of cookies) {
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=lax')
      expect(cookie).toContain('Path=/')
      expect(cookie).not.toContain('secret123')
    }
    expect(cookies.some((c) => c.startsWith('folio-note-pw-27='))).toBe(true)

    // 带密码的响应不可缓存
    expect(response.headers.get('cache-control')).toBe('no-store')

    /*
     * 上游那一侧仍然是查询参数（core 的既有契约）。密码只在
     * 「服务端 → 上游」这一跳出现，浏览器看不到。
     */
    expect(urls[0]).toContain('/notes/nid/27')
    expect(urls[0]).toContain('password=secret123')
  })

  it('密码错误：303 回 ?wrong=1，且不种任何 cookie', async () => {
    stubUpstream('secret123')
    const response = await unlock({ nid: '27', password: 'wrong' })

    expect(response.status).toBe(303)
    const location = response.headers.get('location') ?? ''
    expect(location).toMatch(/\/notes\/27\?wrong=1$/)
    expect(location).not.toContain('wrong=1&password')
    expect(location).not.toContain('password')
    expect(response.headers.getSetCookie()).toHaveLength(0)
  })

  it('空密码不算一次尝试：直接回密码门，不打上游', async () => {
    const urls = stubUpstream('secret123')
    const response = await unlock({ nid: '27', password: '' })

    expect(response.status).toBe(303)
    expect(urls).toHaveLength(0)
    expect(response.headers.getSetCookie()).toHaveLength(0)
  })

  it('日记不存在：404，不伪装成密码错误', async () => {
    vi.stubGlobal('fetch', (async () =>
      new Response(JSON.stringify({ ok: 0, message: '电波无法到达 ωω' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch)

    const response = await unlock({ nid: '27', password: 'any' })
    expect(response.status).toBe(404)
  })

  it('目标不是纯数字：400，不信任表单里的任意值', async () => {
    stubUpstream('secret123')
    // 试图用路径注入改变回跳目标
    const response = await unlock({ nid: '../../evil', password: 'x' })
    expect(response.status).toBe(400)
  })
})
