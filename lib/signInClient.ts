import {
  passkeyWalletSignInResultType,
  passkeyWalletSignInType,
  type PasskeyWalletSignInResult
} from './signInProtocol'

export type PasskeyWalletPopupInput = {
  walletOrigin?: string
  appOrigin?: string
  nonce: string
  chainId: number
  requestId?: string
  requestedAt?: string
  popup?: Window | null
}

type SignInResult = {
  ok?: boolean
  error?: string | null
  status?: number
}

type SignInOptions = {
  csrfToken: string
  message: string
  redirect: false
  signature: string
}

type SubmitCredentials = (
  options: SignInOptions
) => Promise<SignInResult | undefined>

type WalletSignInInput = {
  nonce: string
  chainId: number
  walletOrigin?: string
  popup?: Window | null
}

export type SignInWithPasskeyWalletInput = {
  chainId?: number
  walletOrigin?: string
  getCsrfToken: () => Promise<string | null | undefined>
  requestWalletSignIn?: (
    input: WalletSignInInput
  ) => Promise<PasskeyWalletSignInResult>
  submitCredentials?: SubmitCredentials
}

export const passkeyWalletStackSessionChangedType =
  'organigram:wallet:stack-session-changed'

export type PasskeyWalletStackSessionChangedMessage = {
  type: typeof passkeyWalletStackSessionChangedType
  version: 1
  event: 'revoked'
  appOrigin: string
  address: `0x${string}` | null
}

const defaultWalletOrigin = 'https://localhost:3002'

const getConfiguredWalletOrigin = (): string | undefined =>
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL?.trim() || undefined
    : undefined

const createRequestId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

const normalizeOrigin = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const parseOptionalAddress = (value: unknown): `0x${string}` | null => {
  if (value == null) return null
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return null
  }

  return value as `0x${string}`
}

export const parsePasskeyWalletStackSessionChangedMessage = (
  value: unknown
): PasskeyWalletStackSessionChangedMessage | null => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const message = value as Partial<PasskeyWalletStackSessionChangedMessage>
  if (
    message.type !== passkeyWalletStackSessionChangedType ||
    message.version !== 1 ||
    message.event !== 'revoked'
  ) {
    return null
  }

  const appOrigin = normalizeOrigin(message.appOrigin)
  if (appOrigin == null) return null

  const address = parseOptionalAddress(message.address)
  if (message.address != null && address == null) return null

  return {
    type: passkeyWalletStackSessionChangedType,
    version: 1,
    event: 'revoked',
    appOrigin,
    address
  }
}

export const createPasskeyWalletStackSessionChangedMessage = ({
  event,
  appOrigin,
  address
}: {
  event: 'revoked'
  appOrigin: string
  address?: `0x${string}` | null
}): PasskeyWalletStackSessionChangedMessage => {
  const message = parsePasskeyWalletStackSessionChangedMessage({
    type: passkeyWalletStackSessionChangedType,
    version: 1,
    event,
    appOrigin,
    address: address ?? null
  })
  if (message == null) {
    throw new Error('Invalid Organigram stack session change message.')
  }

  return message
}

export const notifyPasskeyWalletStackSessionChanged = ({
  event,
  appOrigin,
  address,
  targetOrigin = appOrigin
}: {
  event: 'revoked'
  appOrigin: string
  address?: `0x${string}` | null
  targetOrigin?: string
}): void => {
  if (typeof window === 'undefined') return

  const normalizedTargetOrigin = normalizeOrigin(targetOrigin)
  if (normalizedTargetOrigin == null) return

  const message = createPasskeyWalletStackSessionChangedMessage({
    event,
    appOrigin,
    address
  })
  const targets = [
    window.opener,
    window.parent !== window ? window.parent : null
  ].filter((target): target is Window => target != null)

  for (const target of targets) {
    target.postMessage(message, normalizedTargetOrigin)
  }
}

export const buildPasskeyWalletSignInPopupUrl = ({
  walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin,
  appOrigin = window.location.origin,
  nonce,
  chainId,
  requestId = createRequestId(),
  requestedAt = new Date().toISOString()
}: PasskeyWalletPopupInput): URL => {
  const normalizedAppOrigin = new URL(appOrigin).origin
  const challengeUrl = new URL(
    '/api/auth/wallet/challenge',
    normalizedAppOrigin
  )
  challengeUrl.searchParams.set('nonce', nonce)
  challengeUrl.searchParams.set('chainId', chainId.toString())

  const popupUrl = new URL(walletOrigin)
  popupUrl.pathname = '/request'
  popupUrl.searchParams.set('type', passkeyWalletSignInType)
  popupUrl.searchParams.set('version', '1')
  popupUrl.searchParams.set('requestId', requestId)
  popupUrl.searchParams.set('domain', new URL(normalizedAppOrigin).host)
  popupUrl.searchParams.set('challengeUrl', challengeUrl.toString())
  popupUrl.searchParams.set('requestedAt', requestedAt)
  return popupUrl
}

export const requestPasskeyWalletSignIn = async ({
  nonce,
  chainId,
  popup: preparedPopup,
  walletOrigin,
  timeoutMs = 5 * 60 * 1000
}: PasskeyWalletPopupInput & {
  timeoutMs?: number
}): Promise<PasskeyWalletSignInResult> => {
  const requestId = createRequestId()
  const popupUrl = buildPasskeyWalletSignInPopupUrl({
    walletOrigin,
    nonce,
    chainId,
    requestId
  })
  const expectedOrigin = popupUrl.origin
  const popup =
    preparedPopup ??
    window.open(
      popupUrl.toString(),
      'passkey-wallet-sign-in',
      'popup,width=480,height=720'
    )
  if (popup == null) {
    throw new Error('Unable to open Organigram Passkey Wallet popup.')
  }
  const openedPopup = popup
  if (preparedPopup != null) {
    openedPopup.location.href = popupUrl.toString()
    openedPopup.focus()
  }

  return await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('Organigram Passkey Wallet sign-in timed out.'))
    }, timeoutMs)

    const cleanup = (): void => {
      window.clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
    }

    function handleMessage(event: MessageEvent): void {
      if (event.origin !== expectedOrigin) return
      const data = event.data as Partial<PasskeyWalletSignInResult> | null
      if (
        data == null ||
        data.type !== passkeyWalletSignInResultType ||
        data.version !== 1 ||
        data.requestId !== requestId ||
        typeof data.message !== 'string' ||
        typeof data.signature !== 'string' ||
        typeof data.address !== 'string'
      ) {
        return
      }

      cleanup()
      openedPopup.close()
      resolve(data as PasskeyWalletSignInResult)
    }

    window.addEventListener('message', handleMessage)
  })
}

export const submitPasskeyWalletCredentials: SubmitCredentials = async ({
  csrfToken,
  message,
  signature
}) => {
  const response = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      csrfToken,
      message,
      redirect: 'false',
      signature,
      callbackUrl: window.location.href,
      json: 'true'
    })
  })
  const body = (await response.json().catch(() => null)) as {
    url?: string | null
  } | null
  const error =
    typeof body?.url === 'string'
      ? new URL(body.url, window.location.origin).searchParams.get('error')
      : null

  if (response.ok) {
    notifyCurrentTabNextAuthSessionChanged()
  }

  return {
    error,
    status: response.status,
    ok: response.ok
  }
}

const nextAuthSessionStorageEventKey = 'nextauth.message'

export const notifyCurrentTabNextAuthSessionChanged = (): void => {
  if (typeof window === 'undefined') return

  const newValue = JSON.stringify({
    event: 'session',
    data: { trigger: 'getSession' },
    timestamp: Math.floor(Date.now() / 1000)
  })

  try {
    window.localStorage.setItem(nextAuthSessionStorageEventKey, newValue)
  } catch {
    // Local storage can be unavailable in hardened browser modes.
  }

  if (typeof StorageEvent === 'function') {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: nextAuthSessionStorageEventKey,
        newValue
      })
    )
    return
  }

  const event = new Event('storage')
  Object.defineProperty(event, 'key', { value: nextAuthSessionStorageEventKey })
  Object.defineProperty(event, 'newValue', { value: newValue })
  window.dispatchEvent(event)
}

const openPasskeyWalletPopupShell = (): Window | null | undefined => {
  if (typeof window === 'undefined') return undefined

  return window.open('', 'passkey-wallet-sign-in', 'popup,width=480,height=720')
}

export const signInWithPasskeyWallet = async ({
  chainId = 11155111,
  walletOrigin,
  getCsrfToken,
  requestWalletSignIn = requestPasskeyWalletSignIn,
  submitCredentials = submitPasskeyWalletCredentials
}: SignInWithPasskeyWalletInput): Promise<PasskeyWalletSignInResult> => {
  const popup =
    requestWalletSignIn === requestPasskeyWalletSignIn
      ? openPasskeyWalletPopupShell()
      : undefined

  const nonce = await getCsrfToken()
  if (nonce == null || nonce === '') {
    popup?.close()
    throw new Error('Missing CSRF token')
  }

  const walletResult = await requestWalletSignIn({
    nonce,
    chainId,
    walletOrigin,
    popup
  }).catch(error => {
    popup?.close()
    throw error
  })

  const signInResult = await submitCredentials({
    csrfToken: nonce,
    message: walletResult.message,
    redirect: false,
    signature: walletResult.signature
  })

  if (signInResult?.ok !== true || signInResult.error != null) {
    throw new Error(signInResult?.error ?? 'Failed to login')
  }

  notifyCurrentTabNextAuthSessionChanged()
  return walletResult
}
