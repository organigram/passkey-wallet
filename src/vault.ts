import {
  createEncryptionKeyVersion,
  exportUserPrivateKey,
  exportUserPublicKey,
  generateUserEncryptionKeyPair
} from '@organigram/js'

export type PasskeyWalletVaultPayload = {
  version: 1
  recoveryPhrase: string
  userEncryptionPrivateKey: JsonWebKey
  userEncryptionPublicKey: JsonWebKey
  userEncryptionKeyVersion: number
}

export const serializePasskeyWalletVaultPayload = ({
  recoveryPhrase,
  userEncryptionPrivateKey,
  userEncryptionPublicKey,
  userEncryptionKeyVersion
}: Omit<PasskeyWalletVaultPayload, 'version'>): string =>
  JSON.stringify({
    version: 1,
    recoveryPhrase,
    userEncryptionPrivateKey,
    userEncryptionPublicKey,
    userEncryptionKeyVersion
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
  if (payload.userEncryptionPrivateKey == null) {
    throw new Error('Passkey wallet vault is missing its IPFS private key.')
  }
  if (payload.userEncryptionPublicKey == null) {
    throw new Error('Passkey wallet vault is missing its IPFS public key.')
  }
  if (
    !Number.isInteger(payload.userEncryptionKeyVersion) ||
    payload.userEncryptionKeyVersion == null
  ) {
    throw new Error('Passkey wallet vault has an invalid IPFS key version.')
  }

  return payload as PasskeyWalletVaultPayload
}

export const createPasskeyWalletVaultPayload = async (
  recoveryPhrase: string
): Promise<PasskeyWalletVaultPayload> => {
  const userEncryptionKeyPair = await generateUserEncryptionKeyPair()
  const userEncryptionPrivateKey = await exportUserPrivateKey(
    userEncryptionKeyPair
  )
  const userEncryptionPublicKey = await exportUserPublicKey(
    userEncryptionKeyPair
  )

  return {
    version: 1,
    recoveryPhrase,
    userEncryptionPrivateKey,
    userEncryptionPublicKey,
    userEncryptionKeyVersion: createEncryptionKeyVersion()
  }
}
