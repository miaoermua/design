import type { Project } from '@/lib/api/domain/project'
import type { Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'

/**
 * 项目卡片网格
 *
 * 设计语言：温暖编辑式的作品展示。每张卡片是一个 surface-raised 的纸面，
 * 顶部是头像/首字母 + 项目名，中间描述，底部行动链接（药丸按钮）。
 * 响应式：手机 1 列 → 平板 2 列 → 桌面 3 列。
 */

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

function nameToHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

interface ProjectGridProps {
  items: Project[]
  locale: Locale
}

export function ProjectGrid({ items, locale }: ProjectGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((project) => {
        const hue = nameToHue(project.name)
        const hasPreview = Boolean(project.previewUrl)
        const hasDocs = Boolean(project.docUrl)

        return (
          <article
            key={project.id}
            className="group flex flex-col overflow-hidden bg-[var(--surface-raised)] shadow-[var(--shadow-raise)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {/* 头部：头像 + 项目名 */}
            <div className="flex items-center gap-3 border-b border-[var(--edge)] px-5 py-4">
              {project.avatar ? (
                <img
                  src={project.avatar}
                  alt=""
                  className="size-10 shrink-0 rounded-full bg-[var(--surface-sunk)] object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold text-white"
                  style={{ backgroundColor: `hsl(${hue}, 40%, 55%)` }}
                  aria-hidden="true"
                >
                  {getInitial(project.name)}
                </span>
              )}
              <h2 className="text-small min-w-0 truncate font-medium text-[var(--text-heading)] group-hover:text-[var(--accent-strong)]">
                {project.name}
              </h2>
            </div>

            {/* 描述与行动链接 */}
            <div className="flex flex-1 flex-col px-5 py-4">
              <p className="text-caption line-clamp-3 flex-1 leading-relaxed text-[var(--text-secondary)]">
                {project.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={project.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--edge)] px-3 py-1 text-meta text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  <GitHubIcon />
                  {t(locale, 'projects.github')}
                </a>

                {hasPreview ? (
                  <a
                    href={project.previewUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--edge)] px-3 py-1 text-meta text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  >
                    <ExternalLinkIcon />
                    {t(locale, 'projects.preview')}
                  </a>
                ) : null}

                {hasDocs ? (
                  <a
                    href={project.docUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--edge)] px-3 py-1 text-meta text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  >
                    <BookIcon />
                    {t(locale, 'projects.docs')}
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
