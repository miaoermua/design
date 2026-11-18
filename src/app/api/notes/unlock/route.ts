import { NextResponse } from 'next/server'
import { getDiary, getDiaryByNid, isNotFound, isPasswordRequired } from '@/lib/api'
import { requireFeature } from '@/core/registry/guard'
import { notePath } from '@/lib/routes'
import {
  encodePassword,
  legacyPasswordCookieName,
  MAX_PASSWORD_LENGTH,
  notePasswordCookieOptions,
  passwordCookieName,
} from '@/features/diaries/note-password'

/**
 * POST /api/notes/unlock —— 提交受保护日记的密码
 *
 * ## 为什么存在这条路由
 *
 * 上游契约是 `GET /notes/:id?password=`，密码只能走查询参数。如果让浏览器直接
 * 带着 `?password=` 请求页面，密码会同时出现在：地址栏、浏览器历史、`Referer`、
 * 以及服务器访问日志里——每一条都是不该有的副本。
 *
 * 所以把「交密码」与「读页面」拆开：
 *   POST 本路由（密码在请求体里，不进 URL）
 *     → 服务端向上游校验
 *     → 成功：种下 httpOnly cookie，303 到**不含密码**的干净地址
 *     → 失败：303 回原页面并带 `?wrong=1`（`wrong` 不是秘密，可以出现在 URL）
 *
 * ## 为什么成功用 303 而不是 308
 *
 * 308 会**保留请求方法**，浏览器拿到它会重发一次 POST，把密码再交一遍——既多余
 * 又可能形成环。303（See Other）明确要求「改用 GET 去那个地址」，正是表单提交后
 * 该有的语义。旧路由自己的 GET → `/notes/:nid` 仍然是 308，永久迁移的语义没变：
 * 状态码按「请求方法是否该被保留」分工，不是随手改的。
 *
 * ## 为什么回跳地址由服务端算
 *
 * 不接受请求里的任意 `return` 参数——那等于开一个开放重定向。回跳目标只根据
 * 校验过的 `nid` / `id`（纯数字）拼出来，形态固定在 `/notes/:nid` 与
 * `/diaries/:id` 两种之内。
 */

export const dynamic = 'force-dynamic'

/** 表单可能带 `nid`（正式路由）或 `id`（旧雪花 id 路由） */
interface UnlockTarget {
  field: 'nid' | 'id'
  value: string
}

function readTarget(form: FormData): UnlockTarget | null {
  const nid = form.get('nid')
  if (typeof nid === 'string' && /^[1-9]\d{0,18}$/.test(nid)) {
    return { field: 'nid', value: nid }
  }
  const id = form.get('id')
  if (typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id)) {
    return { field: 'id', value: id }
  }
  return null
}

/** 失败后回到哪个页面：只用已校验的数字拼地址，绝不采信外部传入的路径 */
function failurePath(target: UnlockTarget): string {
  const base = target.field === 'nid' ? notePath(target.value) : `/diaries/${target.value}`
  return `${base}?wrong=1`
}

export async function POST(request: Request) {
  requireFeature('diaries')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return new NextResponse('invalid form', { status: 400 })
  }

  const target = readTarget(form)
  if (!target) return new NextResponse('invalid target', { status: 400 })

  const raw = form.get('password')
  const password = typeof raw === 'string' ? raw : ''
  // 空密码不算一次尝试：直接回到密码门，不打上游、不种 cookie
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.redirect(new URL(failurePath(target), request.url), 303)
  }

  try {
    // 校验就是拿密码真的取一次正文：上游通过即代表密码正确
    const diary =
      target.field === 'nid'
        ? await getDiaryByNid(Number(target.value), password)
        : await getDiary(target.value, password)

    /*
     * 同时写两个键：`/notes/:nid` 用 nid 读，`/diaries/:雪花id` 用 id 读。
     * 旧路由只拿到雪花 id，解不出 nid（解出正文需要密码，循环），
     * 因此两个键都种下，读者从任一地址进来都不会再被问一次。
     */
    const encoded = encodePassword(password)
    const options = notePasswordCookieOptions()
    const response = NextResponse.redirect(new URL(notePath(diary.nid), request.url), 303)
    response.cookies.set(passwordCookieName(diary.nid), encoded, options)
    response.cookies.set(legacyPasswordCookieName(diary.id), encoded, options)
    // 带密码的响应绝不能被缓存
    response.headers.set('cache-control', 'no-store')
    return response
  } catch (error) {
    if (isNotFound(error)) {
      // 日记不存在：这不是「密码错了」，给 404 而不是回密码门
      return new NextResponse('not found', { status: 404 })
    }
    if (isPasswordRequired(error)) {
      const response = NextResponse.redirect(new URL(failurePath(target), request.url), 303)
      response.headers.set('cache-control', 'no-store')
      return response
    }
    throw error
  }
}
