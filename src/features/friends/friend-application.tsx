'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import type { FriendLinkApplicationInput, SiteIdentity } from '@/lib/api'
import { useLocale } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { t } from '@/lib/i18n/dictionary'
import type { FriendApplicationFailureReason } from './application-errors'

type CapabilityState = 'loading' | 'open' | 'closed' | 'unknown'
type FormState = 'idle' | 'submitting' | 'sent' | 'failed'
type CopyState = 'idle' | 'copied' | 'failed'
type PublicFriendLinkData = Pick<
  FriendLinkApplicationInput,
  'author' | 'name' | 'url' | 'avatar' | 'description'
>

const FAILURE_MESSAGE: Record<FriendApplicationFailureReason, MessageKey> = {
  invalid: 'friends.applyErrorInvalid',
  closed: 'friends.applyErrorClosed',
  rejected: 'friends.applyErrorRejected',
  network: 'friends.applyErrorNetwork',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFailureReason(value: unknown): FriendApplicationFailureReason | null {
  if (!isRecord(value) || value.status !== 'error') return null
  switch (value.reason) {
    case 'invalid':
    case 'closed':
    case 'rejected':
    case 'network':
      return value.reason
    default:
      return null
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function getSiteAvatar(identity: SiteIdentity | null): string | null {
  const candidates = [identity?.owner.avatar, identity?.icon]
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.length <= 200 && isHttpsUrl(candidate),
    ) ?? null
  )
}

function toPublicFriendLinkData(identity: SiteIdentity | null): PublicFriendLinkData | null {
  const avatar = getSiteAvatar(identity)
  if (
    !identity?.title ||
    !identity.description ||
    !identity.siteUrl ||
    !avatar ||
    !identity.owner.name
  ) {
    return null
  }

  if (
    identity.title.length > 20 ||
    identity.description.length > 50 ||
    identity.owner.name.length > 20 ||
    !isHttpsUrl(identity.siteUrl)
  ) {
    return null
  }

  return {
    author: identity.owner.name,
    name: identity.title,
    url: identity.siteUrl,
    avatar,
    description: identity.description,
  }
}

export function FriendApplication({ siteIdentity }: { siteIdentity: SiteIdentity | null }) {
  const locale = useLocale()
  const headingId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [capability, setCapability] = useState<CapabilityState>('loading')
  const [open, setOpen] = useState(false)
  const [formState, setFormState] = useState<FormState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const siteLinkData = toPublicFriendLinkData(siteIdentity)
  const siteAvatar = getSiteAvatar(siteIdentity)

  useEffect(() => {
    let active = true

    async function loadCapability() {
      try {
        const response = await fetch('/api/friends/apply', { cache: 'no-store' })
        const payload: unknown = await response.json()
        if (
          !response.ok ||
          !isRecord(payload) ||
          payload.status !== 'ok' ||
          typeof payload.canApply !== 'boolean'
        ) {
          throw new Error('Unable to read friend-link application capability')
        }
        if (active) setCapability(payload.canApply ? 'open' : 'closed')
      } catch {
        if (active) setCapability('unknown')
      }
    }

    void loadCapability()
    return () => {
      active = false
    }
  }, [])

  function openForm() {
    setFormState('idle')
    setMessage(null)
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setFormState('idle')
    setMessage(null)
  }

  async function copySiteInfo() {
    if (!siteLinkData) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable')
      await navigator.clipboard.writeText(JSON.stringify(siteLinkData, null, 2))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (formState === 'submitting' || formState === 'sent') return

    const form = event.currentTarget
    const data = new FormData(form)
    const payload = {
      author: String(data.get('author') ?? '').trim(),
      name: String(data.get('name') ?? '').trim(),
      url: String(data.get('url') ?? '').trim(),
      avatar: String(data.get('avatar') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    }

    setFormState('submitting')
    setMessage(null)

    try {
      const response = await fetch('/api/friends/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result: unknown = await response.json()
      if (response.ok && isRecord(result) && result.status === 'ok') {
        setFormState('sent')
        setMessage(t(locale, 'friends.applySuccess'))
        form.reset()
        return
      }

      const reason = readFailureReason(result) ?? 'network'
      setFormState('failed')
      setMessage(t(locale, FAILURE_MESSAGE[reason]))
    } catch {
      setFormState('failed')
      setMessage(t(locale, FAILURE_MESSAGE.network))
    }
  }

  const formId = useId()

  return (
    <section className="friend-application" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-h3 text-heading font-serif">
        {t(locale, 'friends.applyHeading')}
      </h2>
      <p className="friend-application__description">{t(locale, 'friends.applyDescription')}</p>

      <div className="friend-application__site">
        <h3 className="friend-application__site-title">{t(locale, 'friends.siteInfoHeading')}</h3>
        {siteIdentity ? (
          <dl className="friend-application__details">
            {(
              [
                ['friends.siteTitleLabel', siteIdentity.title],
                ['friends.siteDescriptionLabel', siteIdentity.description],
                ['friends.siteAddressLabel', siteIdentity.siteUrl],
                ['friends.siteIconLabel', siteAvatar],
                ['friends.siteOwnerLabel', siteIdentity.owner.name],
              ] satisfies Array<[MessageKey, string | null]>
            ).map(([labelKey, value]) => (
              <div key={labelKey} className="friend-application__detail">
                <dt>{t(locale, labelKey)}</dt>
                <dd>{value || t(locale, 'friends.siteInfoMissing')}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p role="status" className="friend-application__status">
            {t(locale, 'friends.siteInfoUnavailable')}
          </p>
        )}
        {siteIdentity ? (
          <div className="friend-application__copy-row">
            <button
              type="button"
              className="friend-application__copy"
              disabled={!siteLinkData}
              onClick={copySiteInfo}
            >
              {t(locale, 'friends.siteInfoCopy')}
            </button>
            {!siteLinkData ? (
              <p role="status" className="friend-application__status">
                {t(locale, 'friends.siteInfoIncomplete')}
              </p>
            ) : null}
            {copyState === 'copied' ? (
              <p role="status" className="friend-application__status">
                {t(locale, 'friends.siteInfoCopied')}
              </p>
            ) : null}
            {copyState === 'failed' ? (
              <p
                role="alert"
                className="friend-application__message friend-application__message--error"
              >
                {t(locale, 'friends.siteInfoCopyFailed')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="friend-application__action">
        {capability === 'loading' ? (
          <p role="status" className="friend-application__status">
            {t(locale, 'friends.applyStatusLoading')}
          </p>
        ) : null}
        {capability === 'closed' ? (
          <p role="status" className="friend-application__status">
            {t(locale, 'friends.applyClosed')}
          </p>
        ) : null}
        {capability === 'unknown' ? (
          <p role="status" className="friend-application__status">
            {t(locale, 'friends.applyStatusError')}
          </p>
        ) : null}
        {capability === 'open' || capability === 'unknown' ? (
          <button
            ref={triggerRef}
            type="button"
            className="friend-application__trigger"
            onClick={openForm}
          >
            {t(locale, 'friends.applyAction')}
          </button>
        ) : null}
      </div>

      {open ? (
        <ApplicationDialog
          formId={formId}
          locale={locale}
          formState={formState}
          message={message}
          onClose={closeForm}
          onSubmit={submitApplication}
          returnFocusRef={triggerRef}
        />
      ) : null}
    </section>
  )
}

function ApplicationDialog({
  formId,
  locale,
  formState,
  message,
  onClose,
  onSubmit,
  returnFocusRef,
}: {
  formId: string
  locale: ReturnType<typeof useLocale>
  formState: FormState
  message: string | null
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  returnFocusRef: RefObject<HTMLElement | null>
}) {
  const titleId = useId()
  const introId = useId()
  const sending = formState === 'submitting'
  const sent = formState === 'sent'

  return (
    <Dialog
      labelledBy={titleId}
      describedBy={introId}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      className="friend-application-modal"
    >
      <div className="friend-application__head">
        <div>
          <h2 id={titleId} className="friend-application__title">
            {t(locale, 'friends.applyModalTitle')}
          </h2>
          <p id={introId} className="friend-application__intro">
            {t(locale, 'friends.applyModalIntro')}
          </p>
        </div>
        <DialogClose label={t(locale, 'friends.applyClose')} onClose={onClose} />
      </div>

      <div className="friend-application__body">
        <form onSubmit={onSubmit}>
          <fieldset className="friend-application__fields" disabled={sent}>
            <label htmlFor={`${formId}-author`}>
              {t(locale, 'friends.applyAuthor')}
              <input
                id={`${formId}-author`}
                name="author"
                type="text"
                required
                maxLength={20}
                autoComplete="name"
                className="friend-application__input"
              />
            </label>
            <label htmlFor={`${formId}-name`}>
              {t(locale, 'friends.applyName')}
              <input
                id={`${formId}-name`}
                name="name"
                type="text"
                required
                maxLength={20}
                autoComplete="organization"
                className="friend-application__input"
              />
            </label>
            <label htmlFor={`${formId}-url`}>
              {t(locale, 'friends.applyUrl')}
              <input
                id={`${formId}-url`}
                name="url"
                type="url"
                required
                pattern="https://.+"
                placeholder="https://"
                autoComplete="url"
                className="friend-application__input"
              />
            </label>
            <label htmlFor={`${formId}-avatar`}>
              {t(locale, 'friends.applyAvatar')}
              <input
                id={`${formId}-avatar`}
                name="avatar"
                type="url"
                required
                maxLength={200}
                pattern="https://.+"
                placeholder="https://"
                autoComplete="url"
                className="friend-application__input"
              />
            </label>
            <label htmlFor={`${formId}-email`}>
              {t(locale, 'friends.applyEmail')}
              <input
                id={`${formId}-email`}
                name="email"
                type="email"
                required
                maxLength={50}
                autoComplete="email"
                className="friend-application__input"
              />
            </label>
            <label htmlFor={`${formId}-description`}>
              {t(locale, 'friends.applyDescriptionField')}
              <textarea
                id={`${formId}-description`}
                name="description"
                required
                maxLength={50}
                rows={3}
                className="friend-application__input friend-application__textarea"
              />
            </label>
          </fieldset>

          <div className="friend-application__submit-row">
            <button type="submit" className="friend-application__submit" disabled={sending || sent}>
              {sending
                ? t(locale, 'friends.applySubmitting')
                : t(locale, sent ? 'friends.applySubmitted' : 'friends.applySubmit')}
            </button>
            {message ? (
              <p
                role={formState === 'failed' ? 'alert' : 'status'}
                className={
                  formState === 'failed'
                    ? 'friend-application__message friend-application__message--error'
                    : 'friend-application__message'
                }
              >
                {message}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </Dialog>
  )
}
