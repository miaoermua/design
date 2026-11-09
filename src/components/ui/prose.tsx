import { MediaEnhancer } from '@/components/markdown/media-enhancer'
import { cn } from '@/lib/utils/cn'
import { MermaidHydrator } from './mermaid-hydrator'

interface ProseProps {
  html: string
  className?: string
}

/**
 * 正文容器
 * HTML 由服务端 lib/content/markdown 生成（受控标签），这里只负责排版作用域。
 */
export function Prose({ html, className }: ProseProps) {
  return (
    <>
      <div className={cn('prose', className)} dangerouslySetInnerHTML={{ __html: html }} />
      <MermaidHydrator />
      <MediaEnhancer />
    </>
  )
}
