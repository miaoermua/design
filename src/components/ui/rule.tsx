import { cn } from '@/lib/utils/cn'

/** 编辑式分隔线：一律细虚线，不使用实线或粗边 */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn('rule-dashed my-0', className)} />
}
