/**
 * 错误模型
 *
 * 原则：保留真实语义，不做「查不到就当空」的降级。
 * UI 依据错误类型呈现不同状态（未找到 / 密码保护 / 需要配置 / 网络）。
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: number | string | null
  readonly path: string
  readonly body: unknown

  constructor(
    message: string,
    options: { status: number; code?: number | string | null; path: string; body?: unknown },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code ?? null
    this.path = options.path
    this.body = options.body
  }
}

/** 404：后端明确表示资源不存在 */
export class NotFoundError extends ApiError {
  constructor(message: string, options: { path: string; body?: unknown }) {
    super(message, { status: 404, path: options.path, body: options.body })
    this.name = 'NotFoundError'
  }
}

/**
 * 日记需要密码（core：ForbiddenException + ErrorCode.NoteForbidden = 14000）
 * 这是业务状态，不是故障。
 */
export class PasswordRequiredError extends ApiError {
  constructor(options: { path: string; body?: unknown }) {
    super('该日记受密码保护', { status: 403, code: 14000, path: options.path, body: options.body })
    this.name = 'PasswordRequiredError'
  }
}

/** 后端地址/版本等部署配置缺失或非法（构建期与运行期都可能发生） */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

/** 网络层失败（DNS / 连接 / 超时） */
export class NetworkError extends Error {
  readonly path: string
  override readonly cause?: unknown

  constructor(message: string, options: { path: string; cause?: unknown }) {
    super(message)
    this.name = 'NetworkError'
    this.path = options.path
    this.cause = options.cause
  }
}

export function isNotFound(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}

export function isPasswordRequired(error: unknown): error is PasswordRequiredError {
  return error instanceof PasswordRequiredError
}

/** 给页面用的兜底文案：保留原始信息，便于排查 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return `${error.status} ${error.message}`
  if (error instanceof Error) return error.message
  return String(error)
}
