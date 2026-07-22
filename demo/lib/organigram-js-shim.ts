export const createEncryptionKeyVersion = (
  timestamp = Date.now()
): number => Math.floor(timestamp / 1000)

export const generateUserEncryptionKeyPair =
  async (): Promise<CryptoKeyPair> =>
    await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    )

export const exportUserPrivateKey = async (
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> => await crypto.subtle.exportKey('jwk', keyPair.privateKey)

export const exportUserPublicKey = async (
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> => await crypto.subtle.exportKey('jwk', keyPair.publicKey)

