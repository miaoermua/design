/**
 * 结构化数据辅助
 *
 * 只序列化真实存在的字段；不补默认值、不生成站点没有的内容。
 */

/** 序列化 JSON-LD，转义 `<` 防止提前闭合 script */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
