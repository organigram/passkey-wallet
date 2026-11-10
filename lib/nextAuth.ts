import type { Chain, Hex } from 'viem'
import {
  verifyPasskeyWalletSiwe,
  type PasskeyWalletVerifiedSiwe
} from './server'

/** Credentials submitted to the NextAuth credentials provider. */
export type PasskeyWalletNextAuthCredentials = {
  /** Sign-In with Ethereum message. */
  message?: unknown
  /** Signature of the message. */
  signature?: unknown
  /** CSRF token of the session. */
  csrfToken?: unknown
}

/** Input of `authorizePasskeyWalletCredentials()`. */
export type AuthorizePasskeyWalletCredentialsInput = {
  /** Submitted credentials. */
  credentials: PasskeyWalletNextAuthCredentials | undefined
  /** Host of the app. */
  domain: string
  /** Nonce issued by the app, the CSRF token of the session. */
  nonce: string | null | undefined
  /** Chain of the RPC endpoint. */
  chain?: Chain
  /** URL of an RPC endpoint. */
  transportUrl: string
  /** Options of the viem HTTP transport. */
  transportOptions?: Parameters<typeof import('viem').http>[1]
}

/**
 * Verify the credentials submitted to a NextAuth credentials provider by
 * `signInWithPasskeyWallet()`.
 *
 * @remarks
 * Rejects credentials without message, signature or nonce, then verifies them
 * with `verifyPasskeyWalletSiwe()`. The nonce is the CSRF token of the
 * session, which `signInWithPasskeyWallet()` puts in the message.
 * @param input - The credentials, the domain and nonce of the app, and an RPC
 * endpoint.
 * @returns The verified sign-in, or `null`.
 * @example
 * ```ts
 * CredentialsProvider({
 *   credentials: { message: {}, signature: {} },
 *   authorize: async credentials =>
 *     await authorizePasskeyWalletCredentials({
 *       credentials,
 *       domain: 'app.example.com',
 *       nonce: csrfToken,
 *       transportUrl: rpcUrl
 *     })
 * })
 * ```
 */
export const authorizePasskeyWalletCredentials = async ({
  chain,
  credentials,
  domain,
  nonce,
  transportOptions,
  transportUrl
}: AuthorizePasskeyWalletCredentialsInput): Promise<PasskeyWalletVerifiedSiwe | null> => {
  const message = credentials?.message
  const signature = credentials?.signature
  if (
    typeof message !== 'string' ||
    message === '' ||
    typeof signature !== 'string' ||
    !signature.startsWith('0x') ||
    nonce == null ||
    nonce === ''
  ) {
    return null
  }

  return await verifyPasskeyWalletSiwe({
    chain,
    domain,
    message,
    nonce,
    signature: signature as Hex,
    transportOptions,
    transportUrl
  })
}
