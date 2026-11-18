import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { t } from '@/lib/i18n/dictionary'
import type { Locale } from '@/lib/i18n/config'
import { NOTE_LIST_PATH } from '@/lib/routes'

/**
 * 密码门槛：不通过时不渲染任何正文，也不把 403 当成「内容不存在」。
 *
 * ## 密码走查询参数，跟上游一致
 *
 * 这是**有意**跟随 Shiro / Kami，不是没做完：
 *
 *   - Shiro `NotePasswordForm.tsx`：`searchParams.set('password', …)` 后跳转；
 *   - Kami `notes/[id].tsx`：`ctx.query.password` 直接喂给
 *     `apiClient.note.getNoteByNid(id, { password })`。
 *
 * 两家都是 `?password=` 查询参数、明文进地址栏；上游 core 的接口契约也只有
 * 这一种形态（`NotePasswordQuerySchema`，`GET /notes/:id?password=`）。
 *
 * 我们同样是「服务端读 `?password=` → 转发上游」，只是把请求放在服务端做
 * （本主题不让浏览器直连后端）。**没有**引入 POST 中转、cookie 凭据、签名令牌
 * 这些上游不存在的东西——多两条代码路径、两份状态，收益只是让密码不出现在
 * 自己的地址栏，与整个 MX 生态的行为反而不一致。
 *
 * 用 GET 表单而不是 JS 跳转：无 JS 也能解锁，效果与 Shiro 的跳转等价。
 */
export function PasswordGate({ locale, wrong }: { locale: Locale; wrong: boolean }) {
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

        {/*
         * 提交到当前页面自身（`method="get"`）：`password` 被拼成 `?password=`，
         * 服务端读 searchParams 后转发上游，与上游同一套参数。
         */}
        <form method="get" className="mt-8 flex gap-3">
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
