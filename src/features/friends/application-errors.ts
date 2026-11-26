import { ApiError } from '@/lib/api/errors'

export type FriendApplicationFailureReason = 'invalid' | 'closed' | 'rejected' | 'network'

export function toFriendApplicationFailureReason(
  error: unknown,
): Exclude<FriendApplicationFailureReason, 'invalid'> {
  if (!(error instanceof ApiError)) return 'network'
  if (error.status === 403) return 'closed'
  if (error.status >= 400 && error.status < 500) return 'rejected'
  return 'network'
}
