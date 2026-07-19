import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'

import type {
  OrganigramPasskeyCapabilities,
  UnlockedPasskeyWallet
} from './types'
import {
  createPasskeyWalletVaultPayload,
  type PasskeyWalletVaultPayload
} from './vault'

export const unlockedPasskeyWalletTtlMs = 15 * 60 * 1000

export const createUnlockedPasskeyWallet = ({
  address,
  credentialId,
  vaultPayload,
  now = Date.now()
}: {
  address: `0x${string}`
  credentialId: string
  vaultPayload: PasskeyWalletVaultPayload
  now?: number
}): UnlockedPasskeyWallet => {
  const account = mnemonicToAccount(vaultPayload.recoveryPhrase)

  return {
    address,
    account,
    recoveryPhrase: vaultPayload.recoveryPhrase,
    userEncryptionPrivateKey: vaultPayload.userEncryptionPrivateKey,
    userEncryptionPublicKey: vaultPayload.userEncryptionPublicKey,
    userEncryptionKeyVersion: vaultPayload.userEncryptionKeyVersion,
    credentialId,
    expiresAt: now + unlockedPasskeyWalletTtlMs
  }
}

export const createNewPasskeyWalletVault = async ({
  capabilities
}: {
  capabilities: OrganigramPasskeyCapabilities
}): Promise<{
  address: `0x${string}`
  vaultPayload: PasskeyWalletVaultPayload
}> => {
  const recoveryPhrase = generateMnemonic(english, 128)
  const vaultPayload = await createPasskeyWalletVaultPayload(recoveryPhrase)
  const account = mnemonicToAccount(recoveryPhrase)

  return {
    address: account.address,
    vaultPayload: {
      ...vaultPayload,
      recoveryPhrase:
        capabilities.method === 'register'
          ? vaultPayload.recoveryPhrase
          : vaultPayload.recoveryPhrase
    }
  }
}
