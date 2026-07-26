import {
  createWalletEncryptionKeyPair,
  parseWalletEncryptionKeyPair,
  type WalletEncryptionKeyPairPayload
} from './encryption'

export type PasskeyWalletVaultPayload = {
  version: 1
  recoveryPhrase: string
  walletEncryptionKey?: WalletEncryptionKeyPairPayload
}

export const serializePasskeyWalletVaultPayload = ({
  recoveryPhrase,
  walletEncryptionKey
}: Omit<PasskeyWalletVaultPayload, 'version'>): string =>
  JSON.stringify({
    version: 1,
    recoveryPhrase,
    ...(walletEncryptionKey == null ? {} : { walletEncryptionKey })
  } satisfies PasskeyWalletVaultPayload)

export const parsePasskeyWalletVaultPayload = (
  plaintext: string
): PasskeyWalletVaultPayload => {
  const payload = JSON.parse(plaintext) as Partial<PasskeyWalletVaultPayload>
  if (payload.version !== 1) {
    throw new Error('Unsupported passkey wallet vault payload version.')
  }
  if (
    typeof payload.recoveryPhrase !== 'string' ||
    payload.recoveryPhrase.trim() === ''
  ) {
    throw new Error('Passkey wallet vault is missing its recovery phrase.')
  }
  return {
    version: 1,
    recoveryPhrase: payload.recoveryPhrase,
    ...(payload.walletEncryptionKey == null
      ? {}
      : {
          walletEncryptionKey: parseWalletEncryptionKeyPair(
            payload.walletEncryptionKey
          )
        })
  }
}

export const createPasskeyWalletVaultPayload = async (
  recoveryPhrase: string
): Promise<PasskeyWalletVaultPayload> => ({
  version: 1,
  recoveryPhrase,
  walletEncryptionKey: await createWalletEncryptionKeyPair()
})
