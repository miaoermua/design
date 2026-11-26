import { NextResponse } from 'next/server'
import { isFeatureEnabled } from '@/core/registry/features'
import { toFriendApplicationFailureReason } from '@/features/friends/application-errors'
import {
  applyForFriendLink,
  getFriendLinkApplicationCapability,
  type FriendLinkApplicationInput,
} from '@/lib/api'

export const dynamic = 'force-dynamic'

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length > 0 && text.length <= maxLength ? text : null
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function parseBody(value: unknown): FriendLinkApplicationInput | null {
  if (!isRecord(value)) return null

  const author = requiredText(value.author, 20)
  const name = requiredText(value.name, 20)
  const url = typeof value.url === 'string' ? value.url.trim() : ''
  const email = requiredText(value.email, 50)
  const description = requiredText(value.description, 50)
  if (
    !author ||
    !name ||
    !url ||
    !isHttpsUrl(url) ||
    !email ||
    !EMAIL_SHAPE.test(email) ||
    !description
  ) {
    return null
  }

  const avatar = requiredText(value.avatar, 200)
  if (!avatar || !isHttpsUrl(avatar)) return null

  return {
    author,
    name,
    url,
    avatar,
    email,
    description,
  }
}

function disabledResponse() {
  return NextResponse.json({ status: 'error', reason: 'closed' }, { status: 403 })
}

export async function GET() {
  if (!isFeatureEnabled('friends')) return disabledResponse()

  try {
    const { canApply } = await getFriendLinkApplicationCapability()
    return NextResponse.json({ status: 'ok', canApply })
  } catch {
    return NextResponse.json({ status: 'error', reason: 'network' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!isFeatureEnabled('friends')) return disabledResponse()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })
  }

  const input = parseBody(payload)
  if (!input) return NextResponse.json({ status: 'error', reason: 'invalid' }, { status: 400 })

  try {
    await applyForFriendLink(input)
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    const reason = toFriendApplicationFailureReason(error)
    const status = reason === 'closed' ? 403 : reason === 'network' ? 502 : 400
    return NextResponse.json({ status: 'error', reason }, { status })
  }
}
