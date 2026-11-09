/**
 * 日期格式化（统一在站点时区，避免服务端/客户端时区不一致导致的 hydration 差异）
 */

export interface DateParts {
  year: string
  month: string
  day: string
}

export function getDateParts(iso: string, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [year = '', month = '', day = ''] = formatter.format(new Date(iso)).split('-')
  return { year, month, day }
}

/** 2026 年 11 月 2 日 */
export function formatDate(iso: string, timeZone: string): string {
  const { year, month, day } = getDateParts(iso, timeZone)
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`
}

/** 11 月 2 日 */
export function formatMonthDay(iso: string, timeZone: string): string {
  const { month, day } = getDateParts(iso, timeZone)
  return `${Number(month)} 月 ${Number(day)} 日`
}

/** 2026.11.02 —— 用于编辑式元信息 */
export function formatCompact(iso: string, timeZone: string): string {
  const { year, month, day } = getDateParts(iso, timeZone)
  return `${year}.${month}.${day}`
}

export function formatYear(iso: string, timeZone: string): string {
  return getDateParts(iso, timeZone).year
}

/** 2026-11-02（用于 <time datetime>） */
export function toDateTimeAttr(iso: string, timeZone: string): string {
  const { year, month, day } = getDateParts(iso, timeZone)
  return `${year}-${month}-${day}`
}

/** weekday: 周一 */
export function formatWeekday(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'short' }).format(new Date(iso))
}

export function isSameDay(a: string, b: string, timeZone: string): boolean {
  return toDateTimeAttr(a, timeZone) === toDateTimeAttr(b, timeZone)
}

/** 18:42（站点时区） */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** 11 月 —— 归档与日记的时间轴标题 */
export function formatMonthLabel(iso: string, timeZone: string): string {
  const { month } = getDateParts(iso, timeZone)
  return `${Number(month)} 月`
}
