export const passkeyVaultAlgorithm = 'AES-GCM-HKDF-SHA-256'
export const passkeyVaultKeyVersion = 2

export type PasskeyVaultEnvelopeData = {
  algorithm: typeof passkeyVaultAlgorithm
  keyVersion: typeof passkeyVaultKeyVersion
  ciphertext: string
  salt: string
  // Random PRF input evaluated by the passkey for this vault only, so that no
  // two vaults (nor any other application on the same RP ID) share a PRF
  // output. It is not secret: without the passkey it yields nothing.
  prfSalt: string
  nonce: string
}

type DerivePasskeyVaultKeyInput = {
  prfOutput: Uint8Array
  salt: Uint8Array
  // Separates keys derived from the same PRF output for different purposes.
  info?: string
}

type EncryptPasskeyVaultSecretInput = {
  plaintext: string
  key: CryptoKey
  salt: Uint8Array
  prfSalt: Uint8Array
  nonce?: Uint8Array
}

type DecryptPasskeyVaultSecretInput = {
  envelope: PasskeyVaultEnvelopeData
  key: CryptoKey
}

type PrfSupportCredential = {
  getClientExtensionResults: () => {
    prf?: {
      enabled?: boolean
    }
  }
}

export const textEncoder = new TextEncoder()
export const textDecoder = new TextDecoder()

export const getCrypto = (): Crypto => {
  if (globalThis.crypto?.subtle == null) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  return globalThis.crypto
}

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer

export const randomBytes = (length: number): Uint8Array =>
  getCrypto().getRandomValues(new Uint8Array(length))

export const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

// Accepts canonical unpadded base64url only. Lenient decoders silently skip
// unknown characters, so a tampered value could otherwise decode to bytes
// other than the ones it appears to encode.
export const base64UrlToBytes = (value: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new Error('Value must be base64url.')
  }
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  )
  const bytes = base64ToBytes(padded)
  if (bytesToBase64Url(bytes) !== value) {
    throw new Error('Value must be canonical base64url.')
  }

  return bytes
}

export const hasBase64UrlByteLength = (
  value: unknown,
  isValidLength: (byteLength: number) => boolean
): boolean => {
  if (typeof value !== 'string') return false
  try {
    return isValidLength(base64UrlToBytes(value).byteLength)
  } catch {
    return false
  }
}

// AES-GCM appends a 16-byte authentication tag, and vault payloads are never
// empty.
export const isPasskeyVaultEnvelope = (
  value: unknown
): value is PasskeyVaultEnvelopeData => {
  if (typeof value !== 'object' || value == null) return false

  const envelope = value as Partial<PasskeyVaultEnvelopeData>
  return (
    envelope.algorithm === passkeyVaultAlgorithm &&
    envelope.keyVersion === passkeyVaultKeyVersion &&
    hasBase64UrlByteLength(envelope.salt, length => length === 32) &&
    hasBase64UrlByteLength(envelope.prfSalt, length => length === 32) &&
    hasBase64UrlByteLength(envelope.nonce, length => length === 12) &&
    hasBase64UrlByteLength(envelope.ciphertext, length => length > 16)
  )
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export const derivePasskeyVaultKey = async ({
  prfOutput,
  salt,
  info = 'organigram-passkey-wallet-v2'
}: DerivePasskeyVaultKeyInput): Promise<CryptoKey> => {
  if (prfOutput.byteLength !== 32) {
    throw new Error('Passkey PRF output must be 32 bytes.')
  }
  if (salt.byteLength !== 32) {
    throw new Error('Passkey vault salt must be 32 bytes.')
  }

  const crypto = getCrypto()
  // toArrayBuffer copies the PRF output; the copy is zeroed like the original.
  const keyMaterial = toArrayBuffer(prfOutput)
  const baseKey = await crypto.subtle
    .importKey('raw', keyMaterial, 'HKDF', false, ['deriveKey'])
    .finally(() => new Uint8Array(keyMaterial).fill(0))

  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: textEncoder.encode(info)
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  )
}

export const encryptPasskeyVaultSecret = async ({
  plaintext,
  key,
  salt,
  prfSalt,
  nonce = randomBytes(12)
}: EncryptPasskeyVaultSecretInput): Promise<PasskeyVaultEnvelopeData> => {
  if (plaintext.trim() === '') {
    throw new Error('Passkey wallet vault plaintext cannot be empty.')
  }
  if (prfSalt.byteLength !== 32) {
    throw new Error('Passkey PRF salt must be 32 bytes.')
  }

  const plaintextBytes = textEncoder.encode(plaintext)
  try {
    const ciphertext = await getCrypto().subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(nonce)
      },
      key,
      plaintextBytes
    )

    return {
      algorithm: passkeyVaultAlgorithm,
      keyVersion: passkeyVaultKeyVersion,
      ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
      salt: bytesToBase64Url(salt),
      prfSalt: bytesToBase64Url(prfSalt),
      nonce: bytesToBase64Url(nonce)
    }
  } finally {
    plaintextBytes.fill(0)
  }
}

export const decryptPasskeyVaultSecret = async ({
  envelope,
  key
}: DecryptPasskeyVaultSecretInput): Promise<string> => {
  try {
    if (envelope.algorithm !== passkeyVaultAlgorithm) {
      throw new Error('Unsupported passkey wallet vault algorithm.')
    }
    if (envelope.keyVersion !== passkeyVaultKeyVersion) {
      throw new Error('Unsupported passkey wallet vault key version.')
    }

    const plaintext = new Uint8Array(
      await getCrypto().subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: toArrayBuffer(base64UrlToBytes(envelope.nonce))
        },
        key,
        toArrayBuffer(base64UrlToBytes(envelope.ciphertext))
      )
    )
    try {
      return textDecoder.decode(plaintext)
    } finally {
      plaintext.fill(0)
    }
  } catch (error) {
    throw new Error('Unable to decrypt passkey wallet.', { cause: error })
  }
}

export const isPasskeyPrfSupported = async ({
  credential
}: {
  credential: PrfSupportCredential | null
}): Promise<boolean> =>
  credential?.getClientExtensionResults().prf?.enabled === true
