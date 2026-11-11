import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { Prose } from '@/components/ui/prose'
import { Toc } from '@/components/ui/toc'
import { renderMarkdown } from '@/lib/content/markdown'

/**
 * Phase 4D 视觉验收专用页面。
 *
 * 作用：把 `src/visual-tests/fixtures/markdown-full.md` 交给真实的 Markdown 渲染管线，
 * 套上与文章详情页相同的版心 / 纸面 / 目录结构，用于按固定视口与主题截图。
 *
 * 边界：
 *   - 只读仓库内的样张文件，不读 API、不读用户内容；
 *   - 不新增任何样式、Token 或组件，排版全部来自现有 `.prose` 与 `reading-sheet`；
 *   - 页面标了 noindex，也没有入口链接；移除本目录即可完全撤销本页面。
 */

const FIXTURE = readFileSync(
  join(process.cwd(), 'src/visual-tests/fixtures/markdown-full.md'),
  'utf8',
)

export const metadata: Metadata = {
  title: 'Markdown 视觉验收样张',
  description: 'Phase 4D 视觉验收专用样张，覆盖 Folio 支持的全部 Markdown 扩展。',
  robots: { index: false, follow: false },
}

export default async function MarkdownVisualTestsPage() {
  const rendered = await renderMarkdown(FIXTURE)

  return (
    <Container>
      <article id="visual-tests-markdown" className="pb-[var(--spacing-section)]">
        <div className="mx-auto grid max-w-[calc(var(--container-prose)+23.5rem)] gap-12 xl:grid-cols-[minmax(0,calc(var(--container-prose)+7rem))_13rem] xl:gap-14">
          <div className="reading-sheet mx-auto w-full max-w-[calc(var(--container-prose)+7rem)] min-w-0">
            <header className="pt-10 sm:pt-0">
              <p className="meta">Phase 4D · VISUAL FIXTURE</p>
              <h1 className="mt-5 font-serif text-[calc(var(--text-display)*0.78)] leading-[1.25] tracking-[-0.022em] text-[var(--text-heading)] sm:text-[calc(var(--text-display)*0.82)] sm:leading-[1.2]">
                Markdown 视觉验收样张
              </h1>
              <p className="sm:text-lead mt-4 font-serif text-[1.0625rem] leading-[1.8] text-[var(--text-secondary)] sm:mt-5 sm:leading-[1.75]">
                覆盖 Folio 实际支持的全部 Markdown 扩展。本页不是用户内容，仅用于截图比对。
              </p>
              <p className="meta mt-7 flex flex-wrap items-center gap-x-1 border-t border-dashed border-[var(--edge)] pt-4">
                <span>来源 src/visual-tests/fixtures/markdown-full.md</span>
                <span className="meta-sep">{rendered.toc.length} 个目录项</span>
              </p>
            </header>

            <div className="mt-10 sm:mt-12">
              <Prose html={rendered.html} />
            </div>
          </div>

          <aside className="hidden xl:block">
            <Toc items={rendered.toc} />
          </aside>
        </div>
      </article>
    </Container>
  )
}
