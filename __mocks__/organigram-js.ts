export const createEncryptionKeyVersion = (): number => 1

export const generateUserEncryptionKeyPair = async (): Promise<CryptoKeyPair> =>
  await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey']
  )

export const exportUserPrivateKey = async (
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> => await crypto.subtle.exportKey('jwk', keyPair.privateKey)

export const exportUserPublicKey = async (
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> => await crypto.subtle.exportKey('jwk', keyPair.publicKey)
