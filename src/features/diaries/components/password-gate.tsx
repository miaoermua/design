import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { t } from '@/lib/i18n/dictionary'
import type { Locale } from '@/lib/i18n/config'
import { NOTE_LIST_PATH } from '@/lib/routes'

/** 表单提交的目标：正式路由给 `nid`，旧雪花 id 路由给 `id` */
export type PasswordTarget = { field: 'nid' | 'id'; value: string }

/**
 * 密码门槛：不通过时不渲染任何正文，也不把 403 当成「内容不存在」。
 *
 * ## 密码用 POST 交，不进 URL
 *
 * 表单提交到 `/api/notes/unlock`，`method="post"`：密码在**请求体**里。
 * 这是硬要求，不是风格选择——若用 `method="get"`，密码会被拼进 `?password=`，
 * 于是同时出现在地址栏、浏览器历史、`Referer` 与服务器访问日志里，每一条都是
 * 不该有的副本。
 *
 * 提交后由那条路由向上游校验（上游只认 `GET /notes/:id?password=`，查询参数
 * 只存在于服务端到服务端那一次请求），成功则种下 httpOnly cookie 并 303 回到
 * **不含密码**的页面地址；失败则 303 回 `?wrong=1`。
 *
 * `wrong` 不是秘密，可以出现在 URL；密码不可以。
 *
 * ## 无需 JS
 *
 * 用原生表单 POST，不是 `fetch`，禁用 JS 也能解锁。没有用 Server Action：
 * 这条路由要在测试里直接用 POST 验证状态码与 `Set-Cookie`，普通 POST 更好验证，
 * 也不必把这块变成客户端边界。
 */
export function PasswordGate({
  target,
  wrong,
  locale,
}: {
  target: PasswordTarget
  wrong: boolean
  locale: Locale
}) {
  return (
    <Container width="narrow">
      <div className="py-24">
        <p className="meta">{t(locale, 'diary.meta')}</p>
        <h1 className="text-title mt-3 font-serif text-[var(--text-heading)]">
          {t(locale, 'diary.protectedHeading')}
        </h1>
        <p className="text-small mt-3 text-[var(--text-secondary)]">
          {wrong ? t(locale, 'diary.wrongPassword') : t(locale, 'diary.passwordHint')}
        </p>

        <form action="/api/notes/unlock" method="post" className="mt-8 flex gap-3">
          {/* 目标由服务端渲染；解锁路由会再校验一次必须是纯数字 */}
          <input type="hidden" name={target.field} value={target.value} />
          <label htmlFor="password" className="sr-only">
            {t(locale, 'diary.password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="text-small min-w-0 flex-1 border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-2 text-[var(--text-heading)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="text-small border border-[var(--text-primary)] bg-[var(--text-primary)] px-4 py-2 text-[var(--surface)]"
          >
            {t(locale, 'diary.read')}
          </button>
        </form>

        <p className="meta mt-4">{t(locale, 'diary.passwordNote')}</p>
        <Link href={NOTE_LIST_PATH} className="link-quiet meta mt-8 inline-block">
          {t(locale, 'diary.backAll')}
        </Link>
      </div>
    </Container>
  )
}
