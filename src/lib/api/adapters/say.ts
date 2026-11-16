import type { V2Say } from '../contracts/v2/say'
import type { Say } from '../domain/say'

export function adaptSay(raw: V2Say): Say {
  return {
    id: raw.id,
    text: raw.text,
    source: raw.source ?? '',
    author: raw.author ?? '',
    createdAt: raw.created_at,
  }
}
