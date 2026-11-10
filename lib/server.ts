import { createPublicClient, http, type Chain, type Hex } from 'viem'
import { createSiweMessage, parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import {
  parseWalletEncryptionPublicKeySiweResource,
  type WalletEncryptionPublicKeySiweResource
} from './encryption'
import type { PasskeyWalletManifest } from './signInProtocol'
import { getAcceptedWalletOrigins, officialWalletOrigin } from './walletOrigin'

export type { PasskeyWalletManifest } from './signInProtocol'

/** A Sign-In with Ethereum message issued by an app for the wallet to sign. */
export type PasskeyWalletChallenge = {
  /** Host of the app. */
  domain: string
  /** Nonce of the message, to check when verifying it. */
  nonce: string
  /** ISO 8601 date of issue. */
  issuedAt: string
  /** ISO 8601 date of expiry, 5 minutes after issue. */
  expiresAt: string
  /** The message to sign. */
  message: string
}

/** A verified Sign-In with Ethereum message. */
export type PasskeyWalletVerifiedSiwe = {
  /** Address that signed in. */
  address: `0x${string}`
  /** Chain of the message. */
  chainId: number
  /** Domain of the message. */
  domain: string
  /** URI of the message. */
  uri: string
  /** Nonce of the message. */
  nonce: string
  /** Public encryption key of the wallet, if the message carries it. */
  encryptionPublicKeyResource: WalletEncryptionPublicKeySiweResource | null
}

/** Input of `verifyPasskeyWalletSiwe()`. */
export type PasskeyWalletVerifySiweInput = {
  /** The signed message. */
  message: string
  /** Its signature. */
  signature: Hex
  /** Domain the message must be for, the host of the app. */
  domain: string
  /** Nonce the message must carry, as issued by the app. */
  nonce: string
  /** Chain of the RPC endpoint. */
  chain?: Chain
  /**
   * URL of an RPC endpoint, used to verify signatures of smart contract
   * accounts.
   */
  transportUrl: string
  /** Options of the viem HTTP transport. */
  transportOptions?: Parameters<typeof http>[1]
}

const localWalletHttpsPort = '3002'

const createRequestId = (): string => {
  if (globalThis.crypto?.randomUUID != null) {
    return globalThis.crypto.randomUUID()
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

const createNonce = (): string => createRequestId().replace(/-/g, '').slice(0, 16)

const parseAllowedOrigins = (value: string | undefined): string[] =>
  value == null
    ? []
    : value
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)

const uniqueOrigins = (origins: string[]): string[] =>
  Array.from(
    new Set(
      origins.map(origin => {
        try {
          return new URL(origin).origin
        } catch {
          return ''
        }
      })
    )
  ).filter(Boolean)

/**
 * Get the public origin of a request, from the `X-Forwarded-Host` and
 * `X-Forwarded-Proto` headers when present.
 *
 * @remarks
 * Clients can set these headers. Only rely on the result behind a proxy that
 * overwrites them.
 * @param request - The request.
 */
export const getPasskeyWalletRequestOrigin = (request: Request): string => {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host =
    forwardedHost?.split(',')[0]?.trim() || request.headers.get('host') || url.host
  const protocol =
    forwardedProto?.split(',')[0]?.trim() || url.protocol.replace(':', '')

  return `${protocol}://${host}`
}

/**
 * Create the manifest of an app, with the challenge URL
 * `/api/auth/wallet/challenge` on the origin of the request.
 *
 * @param request - The request for the manifest.
 */
export const createPasskeyWalletManifest = (
  request: Request
): PasskeyWalletManifest => {
  const origin = getPasskeyWalletRequestOrigin(request)
  const domain = new URL(origin).host

  return {
    version: 1,
    domain,
    signInChallengeUrl: `${origin}/api/auth/wallet/challenge`
  }
}

/**
 * List the wallet origins allowed to call the sign-in endpoints of an app.
 *
 * @remarks
 * Allows the official wallet and its local copy, the configured wallet and its
 * local copy, other configured origins, and, when the app runs on localhost,
 * the wallet served on port 3002 of the same host.
 * @param input - The request, the URL of the configured wallet, and other
 * allowed origins, separated by commas.
 */
export const getPasskeyWalletCorsAllowedOrigins = ({
  allowedOrigins = '',
  request,
  walletUrl
}: {
  request: Request
  walletUrl?: string
  allowedOrigins?: string
}): string[] => {
  const requestOrigin = new URL(getPasskeyWalletRequestOrigin(request))
  // A local Stack also accepts the wallet served on its own host.
  const localOrigins = ['localhost', '127.0.0.1', '[::1]'].includes(
    requestOrigin.hostname
  )
    ? [`https://${requestOrigin.hostname}:${localWalletHttpsPort}`]
    : []

  return uniqueOrigins([
    // The official wallet, and the copy of it a user runs on their machine.
    ...getAcceptedWalletOrigins(officialWalletOrigin),
    ...(walletUrl == null ? [] : parseAllowedOrigins(walletUrl).flatMap(getAcceptedWalletOrigins)),
    ...parseAllowedOrigins(allowedOrigins),
    ...localOrigins
  ])
}

/**
 * Get the origin of a request if it is an allowed wallet origin.
 *
 * @param input - The request, the URL of the configured wallet, and other
 * allowed origins, separated by commas.
 * @returns The origin, or `null`.
 */
export const getPasskeyWalletCorsOrigin = ({
  allowedOrigins,
  request,
  walletUrl
}: {
  request: Request
  walletUrl?: string
  allowedOrigins?: string
}): string | null => {
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin == null || requestOrigin === '') return null

  const normalizedOrigin = new URL(requestOrigin).origin
  return getPasskeyWalletCorsAllowedOrigins({
    request,
    walletUrl,
    allowedOrigins
  }).includes(normalizedOrigin)
    ? normalizedOrigin
    : null
}

/**
 * Add CORS headers with credentials to a response, if the request comes from an
 * allowed wallet origin.
 *
 * @param request - The request.
 * @param response - The response, returned with its headers changed.
 * @param options - Allowed methods, `GET, OPTIONS` by default, the URL of the
 * configured wallet, and other allowed origins.
 */
export const withPasskeyWalletCorsHeaders = <Response extends {
  headers: Headers
}>(
  request: Request,
  response: Response,
  options: {
    allowedMethods?: string
    walletUrl?: string
    allowedOrigins?: string
  } = {}
): Response => {
  const origin = getPasskeyWalletCorsOrigin({
    request,
    walletUrl: options.walletUrl,
    allowedOrigins: options.allowedOrigins
  })
  if (origin == null) return response

  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', options.allowedMethods ?? 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Vary', 'Origin')
  return response
}

/**
 * Create a Sign-In with Ethereum message for an address, valid for 5 minutes.
 *
 * @remarks
 * Store the nonce on the server, for example in the session, and check it with
 * `verifyPasskeyWalletSiwe()`.
 * @param input - The request, the address and chain, and optionally the public
 * key resource from `createWalletEncryptionPublicKeySiweResource()`, a nonce,
 * the current date, a statement and the URI of the app, the origin of the
 * request by default.
 * @throws When the address is not valid.
 */
export const createPasskeyWalletChallenge = ({
  address,
  chainId,
  encryptionPublicKeyResource,
  nonce = createNonce(),
  now = new Date(),
  request,
  statement,
  uri
}: {
  request: Request
  address: `0x${string}`
  chainId: number
  encryptionPublicKeyResource?: string
  nonce?: string
  now?: Date
  statement?: string
  uri?: string
}): PasskeyWalletChallenge => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('A valid wallet address is required.')
  }

  const origin = uri ?? getPasskeyWalletRequestOrigin(request)
  const domain = new URL(origin).host
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000)
  const message = createSiweMessage({
    domain,
    address,
    statement: statement ?? `Sign in to ${domain} with Organigram Passkey Wallet.`,
    uri: origin,
    version: '1',
    chainId,
    nonce,
    issuedAt: now,
    expirationTime: expiresAt,
    resources:
      encryptionPublicKeyResource == null || encryptionPublicKeyResource === ''
        ? undefined
        : [encryptionPublicKeyResource]
  })

  return {
    domain,
    nonce,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    message
  }
}

/**
 * Build the URL of the wallet popup for a sign-in request.
 *
 * @param input - The origin of the wallet, the domain of the app, its challenge
 * URL, and optionally the request identifier, date and return URL.
 */
export const buildPasskeyWalletPopupUrl = ({
  challengeUrl,
  domain,
  requestId = createRequestId(),
  requestedAt = new Date().toISOString(),
  returnUrl,
  walletOrigin
}: {
  walletOrigin: string
  domain: string
  challengeUrl: string
  requestId?: string
  requestedAt?: string
  returnUrl?: string
}): URL => {
  const url = new URL(walletOrigin)
  url.pathname = '/request'
  url.searchParams.set('type', 'organigram:wallet:sign-in')
  url.searchParams.set('version', '1')
  url.searchParams.set('requestId', requestId)
  url.searchParams.set('domain', domain)
  url.searchParams.set('challengeUrl', challengeUrl)
  url.searchParams.set('requestedAt', requestedAt)
  if (returnUrl != null && returnUrl !== '') {
    url.searchParams.set('returnUrl', returnUrl)
  }

  return url
}

/**
 * Check whether an origin is one of a list of allowed origins.
 *
 * @param origin - The origin to check.
 * @param allowedOrigins - The allowed origins.
 */
export const isWalletSignInOriginAllowed = (
  origin: string,
  allowedOrigins: readonly string[]
): boolean => {
  const normalizedOrigin = new URL(origin).origin
  return allowedOrigins.some(
    allowedOrigin => new URL(allowedOrigin).origin === normalizedOrigin
  )
}

/**
 * Verify a Sign-In with Ethereum message signed by the wallet.
 *
 * @remarks
 * Checks the signature, the domain, the nonce and the validity dates of the
 * message with viem. Never pass an empty domain or nonce: viem then skips
 * their check. Check that the nonce is the one the app issued for this
 * session, and use it only once.
 * @param input - The message, signature, expected domain and nonce, and an RPC
 * endpoint.
 * @returns The verified sign-in, or `null` if the message is invalid.
 * @example
 * ```ts
 * const verified = await verifyPasskeyWalletSiwe({
 *   message,
 *   signature,
 *   domain: 'app.example.com',
 *   nonce: session.nonce,
 *   transportUrl: rpcUrl
 * })
 * ```
 */
export const verifyPasskeyWalletSiwe = async ({
  chain,
  domain,
  message,
  nonce,
  signature,
  transportOptions,
  transportUrl
}: PasskeyWalletVerifySiweInput): Promise<PasskeyWalletVerifiedSiwe | null> => {
  const siwe = parseSiweMessage(message)
  if (
    siwe.address == null ||
    siwe.chainId == null ||
    siwe.domain == null ||
    siwe.nonce == null ||
    siwe.uri == null ||
    siwe.version !== '1'
  ) {
    return null
  }

  const isValid = await verifySiweMessage(
    createPublicClient({
      ...(chain == null ? {} : { chain }),
      transport: http(transportUrl, transportOptions)
    }),
    {
      address: siwe.address as `0x${string}`,
      domain,
      message,
      nonce,
      signature
    }
  )
  if (!isValid) return null

  return {
    address: siwe.address as `0x${string}`,
    chainId: siwe.chainId,
    domain: siwe.domain,
    uri: siwe.uri,
    nonce: siwe.nonce,
    encryptionPublicKeyResource: parseWalletEncryptionPublicKeySiweResource({
      address: siwe.address,
      resources: siwe.resources
    })
  }
}
