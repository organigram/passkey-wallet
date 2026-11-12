import {
  passkeyWalletSignInResultType,
  passkeyWalletSignInType,
  type PasskeyWalletSignInResult
} from './signInProtocol'
import {
  getAcceptedWalletOrigins,
  rememberWalletOrigin,
  toPreferredWalletUrl,
  watchLocalWalletPopup
} from './walletOrigin'

/** Input of a sign-in request through the wallet popup. */
export type PasskeyWalletPopupInput = {
  /**
   * Origin of the wallet, `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL` or
   * `https://localhost:3002` by default.
   */
  walletOrigin?: string
  /** Origin of the app, the current origin by default. */
  appOrigin?: string
  /** Nonce of the Sign-In with Ethereum message, issued by the app. */
  nonce: string
  /** Chain of the message. */
  chainId: number
  /** Identifier of the request, random by default. */
  requestId?: string
  /** ISO 8601 date of the request, now by default. */
  requestedAt?: string
  /**
   * A popup opened beforehand, for example synchronously on a click so that the
   * browser does not block it.
   */
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

/** Input of `signInWithPasskeyWallet()`. */
export type SignInWithPasskeyWalletInput = {
  /** Chain of the message, Sepolia (11155111) by default. */
  chainId?: number
  /** Origin of the wallet. */
  walletOrigin?: string
  /**
   * Get the CSRF token of the NextAuth session, used as the nonce of the
   * message.
   */
  getCsrfToken: () => Promise<string | null | undefined>
  /** Ask the wallet to sign in, `requestPasskeyWalletSignIn()` by default. */
  requestWalletSignIn?: (
    input: WalletSignInInput
  ) => Promise<PasskeyWalletSignInResult>
  /**
   * Submit the signed message to the app, `submitPasskeyWalletCredentials()` by
   * default.
   */
  submitCredentials?: SubmitCredentials
}

/**
 * Type of the message telling an app that its session changed in the wallet.
 */
export const passkeyWalletStackSessionChangedType =
  'organigram:wallet:stack-session-changed'

/**
 * A message posted by the wallet to the app that opened it when the user
 * revokes the session of that app.
 */
export type PasskeyWalletStackSessionChangedMessage = {
  /** Always `passkeyWalletStackSessionChangedType`. */
  type: typeof passkeyWalletStackSessionChangedType
  /** Version of the protocol. */
  version: 1
  /** What changed: the session was revoked. */
  event: 'revoked'
  /** Origin of the app. */
  appOrigin: string
  /** Address of the session, if known. */
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

/**
 * Read a session change message.
 *
 * @remarks
 * Also check the origin of the `MessageEvent` carrying it: only trust messages
 * from the wallet.
 * @param value - The data of the message.
 * @returns The message, or `null` if it is invalid.
 */
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

/**
 * Create a session change message.
 *
 * @param input - The event, the origin of the app and the address of the
 * session.
 * @throws When the origin or address is invalid.
 */
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

/**
 * Post a session change message to the window that opened the wallet.
 *
 * @param input - The event, the origin of the app, the address of the session,
 * and the origin to post to, the app origin by default.
 */
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
  window.opener?.postMessage(message, normalizedTargetOrigin)
}

/**
 * Build the URL of the wallet popup for a sign-in request, with the challenge
 * URL `/api/auth/wallet/challenge` of the app.
 *
 * @param input - The sign-in request.
 */
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

/**
 * Ask the wallet, in a popup, to sign a Sign-In with Ethereum message for the
 * app.
 *
 * @remarks
 * Only accepts answers from the wallet origin and its local copy, for this
 * request. The result is not verified: the server must verify it with
 * `verifyPasskeyWalletSiwe()`.
 * @param input - The sign-in request, and a timeout, 5 minutes by default.
 * @returns The signed message.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
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
  const configuredPopupUrl = buildPasskeyWalletSignInPopupUrl({
    walletOrigin,
    nonce,
    chainId,
    requestId
  })
  const configuredOrigin = configuredPopupUrl.origin
  const acceptedOrigins = getAcceptedWalletOrigins(configuredOrigin)
  const popupUrl = toPreferredWalletUrl(configuredPopupUrl)
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
    const stopWatchingLocalWallet = watchLocalWalletPopup({
      popup: openedPopup,
      popupUrl,
      walletOrigin: configuredOrigin,
      requestId
    })
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Organigram Passkey Wallet sign-in timed out.'))
    }, timeoutMs)

    const cleanup = (): void => {
      window.clearTimeout(timeout)
      stopWatchingLocalWallet()
      window.removeEventListener('message', handleMessage)
    }

    function handleMessage(event: MessageEvent): void {
      if (!acceptedOrigins.includes(event.origin)) return
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
      rememberWalletOrigin(configuredOrigin, event.origin)
      openedPopup.close()
      resolve(data as PasskeyWalletSignInResult)
    }

    window.addEventListener('message', handleMessage)
  })
}

/**
 * Submit a signed message to the NextAuth credentials callback of the app, at
 * `/api/auth/callback/credentials`.
 */
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

/**
 * Tell NextAuth in the current tab that the session changed, so that it reloads
 * it.
 */
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

/**
 * Sign in to a NextAuth app with the wallet.
 *
 * @remarks
 * Opens the wallet popup, uses the CSRF token as the nonce of the Sign-In with
 * Ethereum message, and submits the signed message to the NextAuth credentials
 * provider, which verifies it with `authorizePasskeyWalletCredentials()`.
 * @param input - The CSRF token getter, the chain and the wallet origin.
 * @returns The signed message.
 * @throws When the CSRF token is missing or the sign-in fails.
 * @example
 * ```ts
 * import { getCsrfToken } from 'next-auth/react'
 *
 * await signInWithPasskeyWallet({ getCsrfToken })
 * ```
 */
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
