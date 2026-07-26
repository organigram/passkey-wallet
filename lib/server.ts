import { createPublicClient, http, type Chain, type Hex } from 'viem'
import { createSiweMessage, parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import {
  parseWalletEncryptionPublicKeySiweResource,
  type WalletEncryptionPublicKeySiweResource
} from './encryption'

export type PasskeyWalletManifest = {
  version: 1
  domain: string
  signInChallengeUrl: string
  signInCompletionUrl?: string
}

export type PasskeyWalletChallenge = {
  domain: string
  nonce: string
  issuedAt: string
  expiresAt: string
  message: string
}

export type PasskeyWalletVerifiedSiwe = {
  address: `0x${string}`
  chainId: number
  domain: string
  uri: string
  nonce: string
  encryptionPublicKeyResource: WalletEncryptionPublicKeySiweResource | null
}

export type PasskeyWalletVerifySiweInput = {
  message: string
  signature: Hex
  domain: string
  nonce: string
  chain?: Chain
  transportUrl: string
  transportOptions?: Parameters<typeof http>[1]
}

const defaultPasskeyWalletOrigin = 'https://wallet.organigram.ai'
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
  const localOrigins = ['localhost', '127.0.0.1', '[::1]', 'local.organigram.ai']
    .includes(requestOrigin.hostname)
    ? [`https://${requestOrigin.hostname}:${localWalletHttpsPort}`]
    : []

  return uniqueOrigins([
    defaultPasskeyWalletOrigin,
    ...(walletUrl == null ? [] : parseAllowedOrigins(walletUrl)),
    ...parseAllowedOrigins(allowedOrigins),
    ...localOrigins
  ])
}

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

export const isWalletSignInOriginAllowed = (
  origin: string,
  allowedOrigins: readonly string[]
): boolean => {
  const normalizedOrigin = new URL(origin).origin
  return allowedOrigins.some(
    allowedOrigin => new URL(allowedOrigin).origin === normalizedOrigin
  )
}

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
