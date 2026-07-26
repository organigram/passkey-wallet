import type { Chain, Hex } from 'viem'
import {
  verifyPasskeyWalletSiwe,
  type PasskeyWalletVerifiedSiwe
} from './server'

export type PasskeyWalletNextAuthCredentials = {
  message?: unknown
  signature?: unknown
  csrfToken?: unknown
}

export type AuthorizePasskeyWalletCredentialsInput = {
  credentials: PasskeyWalletNextAuthCredentials | undefined
  domain: string
  nonce: string | null | undefined
  chain?: Chain
  transportUrl: string
  transportOptions?: Parameters<typeof import('viem').http>[1]
}

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
