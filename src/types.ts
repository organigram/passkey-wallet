import type { HDAccount } from 'viem/accounts'

export const organigramPasskeyWalletId = 'organigram-passkeys'
export const organigramPasskeyWalletIcon = '/png/logo-gradient.png'

export type OrganigramPasskeyCapabilities = {
  method?: 'login' | 'register'
  name?: string
  identity?: {
    email: string
  }
}

export type PasskeyWalletLoginCapabilities = {
  method: 'login'
}

export type PasskeyWalletRegistrationCapabilities = {
  method: 'register'
  name: string
  identity?: {
    email: string
  }
}

export type PasskeyWalletCapabilities =
  | PasskeyWalletLoginCapabilities
  | PasskeyWalletRegistrationCapabilities

export type IdentityPasskeyCapabilities =
  PasskeyWalletRegistrationCapabilities & {
    identity: {
      email: string
    }
  }

const normalizePasskeyIdentityEmail = (email: string): string =>
  email.trim().toLowerCase()

export const buildIdentityPasskeyCapabilities = (
  email: string
): IdentityPasskeyCapabilities => {
  const normalizedEmail = normalizePasskeyIdentityEmail(email)

  return {
    method: 'register',
    name: normalizedEmail,
    identity: {
      email: normalizedEmail
    }
  }
}

export const buildPasskeyWalletCapabilities =
  (): PasskeyWalletCapabilities => ({
    method: 'login'
  })

export const buildEmailPasskeyCapabilities = buildIdentityPasskeyCapabilities

export type UnlockedPasskeyWallet = {
  address: `0x${string}`
  account: HDAccount
  recoveryPhrase: string
  userEncryptionPrivateKey: JsonWebKey
  userEncryptionPublicKey: JsonWebKey
  userEncryptionKeyVersion: number
  credentialId: string
  expiresAt: number
}

export type PasskeyRegistrationResult = {
  address: `0x${string}`
  credentialId: string
}

export type PasskeyProviderEvent =
  | 'accountsChanged'
  | 'chainChanged'
  | 'disconnect'

export type PasskeyProviderListener = (...args: unknown[]) => void
