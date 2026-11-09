/**
 * 提示类内容（Callout / Banner / GitHub Alerts）：类型表 + HTML 产出
 *
 * 三种形态共用一套「类型 → 语气」的语义，但渲染结构不同：
 *
 *   - callout：带标题的方块（`::: info`）
 *   - banner：通栏横幅，无标题（`::: banner{info}`）
 *   - alert：GitHub 的 `> [!NOTE]`，结构复用 callout，只是类型来源不同
 *
 * 类型分两层：
 *   - `CALLOUT_TYPES` 是作者能写的；未在表内的 `::: xxx` 一律不认，原文照常输出
 *   - `NoticeType` 是渲染层认识的并集，多出的 tip / important / caution 只由
 *     GitHub Alerts 产生，避免把「`::: tip`」这类语法私自扩大
 *
 * 这里只拼字符串，最终仍然要过 `./sanitize`；`type` 与 `title` 都来自受控枚举或转义文本，
 * 不参与任何属性透传。
 */

import { escapeText } from './escape'

/** 作者可写的提示类型（`::: info` …） */
export const CALLOUT_TYPES = ['info', 'warning', 'error', 'danger', 'success', 'note'] as const

export type CalloutType = (typeof CALLOUT_TYPES)[number]

/** 渲染层支持的并集：GitHub Alerts 额外带来 tip / important / caution */
export type NoticeType = CalloutType | 'tip' | 'important' | 'caution'

/** 三种渲染形态 */
export type NoticeKind = 'callout' | 'banner' | 'alert'

/**
 * 标题文案。
 * Alerts 用与 callout 同一套中文标签，而不是照抄 GitHub 的英文，
 * 避免同一篇正文里出现两种语言的同类提示；类型区分靠标签 + 色调。
 */
const NOTICE_LABELS: Record<NoticeType, string> = {
  note: '笔记',
  tip: '提示',
  info: '说明',
  important: '重要',
  success: '完成',
  warning: '注意',
  caution: '谨慎',
  error: '错误',
  danger: '危险',
}

export function isCalloutType(value: string): value is CalloutType {
  return (CALLOUT_TYPES as readonly string[]).includes(value)
}

export function noticeLabel(type: NoticeType): string {
  return NOTICE_LABELS[type]
}

/**
 * 拼出提示容器的 HTML。
 *
 * `title` 允许作者覆盖默认标签（`::: warning 备份已过期`）；
 * 空标题回落到类型标签，因此不会出现「有框无题」的信息缺口。
 */
export function renderNoticeHtml(
  kind: NoticeKind,
  type: NoticeType,
  title: string,
  body: string,
): string {
  if (kind === 'banner') {
    return `<aside class="md-banner md-banner--${type}"><div class="md-banner__body">${body}</div></aside>`
  }

  const label = title.trim() || noticeLabel(type)
  return [
    `<div class="md-callout md-callout--${type}">`,
    `<p class="md-callout__title">${escapeText(label)}</p>`,
    `<div class="md-callout__body">${body}</div>`,
    '</div>',
  ].join('')
}

/** 原生折叠块（`::: details 概要`）：结构与 `<details>` 完全一致，只是由 Markdown 产出 */
export function renderDetailsHtml(summary: string, body: string): string {
  const label = escapeText(summary.trim() || '详情')
  return [
    '<details class="md-details">',
    `<summary class="md-details__summary">${label}</summary>`,
    `<div class="md-details__body">${body}</div>`,
    '</details>',
  ].join('')
}
