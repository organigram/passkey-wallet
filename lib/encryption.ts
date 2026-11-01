import {
  base64UrlToBytes,
  bytesToBase64Url,
  getCrypto,
  randomBytes,
  textDecoder,
  textEncoder,
  toArrayBuffer
} from './crypto'

export type WalletEncryptionKeyPairPayload = {
  version: 1
  algorithm: 'ECDH-P256'
  privateKey: JsonWebKey
  publicKey: JsonWebKey
  keyVersion: number
}

export type WalletEncryptedFilePackage = {
  version: 1
  kind: 'organigram:wallet-encrypted-file'
  algorithm: 'ECDH-P256+A256GCM'
  recipient: {
    address: `0x${string}`
    publicKey: JsonWebKey
    keyVersion: number
  }
  file: {
    name: string
    type: string
    size: number
    lastModified?: number
  }
  iv: string
  ciphertext: string
  encryptedAt: string
}

export type WalletEncryptedPayload = {
  version: 1
  kind: 'organigram:wallet-encrypted-payload'
  algorithm: 'ECDH-P256+A256GCM'
  /** Only this application origin may have the payload decrypted. */
  appOrigin: string
  recipient: {
    address: `0x${string}`
    publicKey: JsonWebKey
    keyVersion: number
  }
  iv: string
  ciphertext: string
  encryptedAt: string
}

export type WalletDecryptedFile = {
  name: string
  type: string
  bytes: Uint8Array
  lastModified?: number
}

const walletFileIvLength = 12
const walletKeyAlgorithm = { name: 'ECDH', namedCurve: 'P-256' } as const
const encryptionPublicKeyResourceKind =
  'organigram.encryption-public-key.v1' as const
const encryptionPublicKeyResourcePrefix =
  'urn:organigram:encryption-public-key:' as const

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const isJsonWebKey = (value: unknown): value is JsonWebKey =>
  isPlainObject(value) && typeof value.kty === 'string' && value.kty !== ''

const getRandomIv = (): Uint8Array => randomBytes(walletFileIvLength)

const createEncryptionKeyVersion = (timestamp = Date.now()): number =>
  Math.floor(timestamp / 1000)

const generateWalletEncryptionCryptoKeyPair =
  async (): Promise<CryptoKeyPair> =>
    await getCrypto().subtle.generateKey(walletKeyAlgorithm, true, [
      'deriveKey',
      'deriveBits'
    ])

const exportWalletPublicKey = async (
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> =>
  await getCrypto().subtle.exportKey('jwk', keyPair.publicKey)

const exportWalletPrivateKey = async (
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> =>
  await getCrypto().subtle.exportKey('jwk', keyPair.privateKey)

const importWalletPublicKey = async (publicKey: JsonWebKey): Promise<CryptoKey> =>
  await getCrypto().subtle.importKey('jwk', publicKey, walletKeyAlgorithm, false, [])

const importWalletPrivateKey = async (
  privateKey: JsonWebKey
): Promise<CryptoKey> =>
  await getCrypto().subtle.importKey('jwk', privateKey, walletKeyAlgorithm, true, [
    'deriveKey',
    'deriveBits'
  ])

export const createWalletEncryptionKeyPair =
  async (): Promise<WalletEncryptionKeyPairPayload> => {
    const keyPair = await generateWalletEncryptionCryptoKeyPair()
    return {
      version: 1,
      algorithm: 'ECDH-P256',
      privateKey: await exportWalletPrivateKey(keyPair),
      publicKey: await exportWalletPublicKey(keyPair),
      keyVersion: createEncryptionKeyVersion()
    }
  }

export const parseWalletEncryptionKeyPair = (
  value: unknown
): WalletEncryptionKeyPairPayload => {
  if (!isPlainObject(value)) {
    throw new Error('Wallet encryption key backup must be an object.')
  }
  if (
    value.version !== 1 ||
    value.algorithm !== 'ECDH-P256' ||
    !isJsonWebKey(value.privateKey) ||
    !isJsonWebKey(value.publicKey) ||
    typeof value.keyVersion !== 'number'
  ) {
    throw new Error('Unsupported wallet encryption key backup.')
  }

  return {
    version: 1,
    algorithm: 'ECDH-P256',
    privateKey: value.privateKey,
    publicKey: value.publicKey,
    keyVersion: value.keyVersion
  }
}

export const createWalletEncryptionPublicKeySiweResource = ({
  address,
  keyPair
}: {
  address: `0x${string}`
  keyPair: WalletEncryptionKeyPairPayload
}): string =>
  `${encryptionPublicKeyResourcePrefix}${bytesToBase64Url(
    textEncoder.encode(
      JSON.stringify({
        kind: encryptionPublicKeyResourceKind,
        address: address.toLowerCase(),
        publicKey: keyPair.publicKey,
        keyVersion: keyPair.keyVersion
      })
    )
  )}`

export type WalletEncryptionPublicKeySiweResource = {
  kind: typeof encryptionPublicKeyResourceKind
  address: string
  publicKey: JsonWebKey
  keyVersion: number
}

export const parseWalletEncryptionPublicKeySiweResource = ({
  address,
  resources
}: {
  address: string
  resources: string[] | undefined
}): WalletEncryptionPublicKeySiweResource | null => {
  const resource = resources?.find(resource =>
    resource.startsWith(encryptionPublicKeyResourcePrefix)
  )
  if (resource == null) return null

  try {
    const payload = JSON.parse(
      textDecoder.decode(
        base64UrlToBytes(resource.substring(encryptionPublicKeyResourcePrefix.length))
      )
    ) as Partial<WalletEncryptionPublicKeySiweResource>
    if (
      payload.kind !== encryptionPublicKeyResourceKind ||
      payload.address?.toLowerCase() !== address.toLowerCase() ||
      !isJsonWebKey(payload.publicKey) ||
      typeof payload.keyVersion !== 'number'
    ) {
      return null
    }

    return {
      kind: encryptionPublicKeyResourceKind,
      address: payload.address.toLowerCase(),
      publicKey: payload.publicKey,
      keyVersion: payload.keyVersion
    }
  } catch {
    return null
  }
}

const deriveSelfEncryptionKey = async (
  keyPair: WalletEncryptionKeyPairPayload
): Promise<CryptoKey> => {
  const privateKey = await importWalletPrivateKey(keyPair.privateKey)
  const publicKey = await importWalletPublicKey(keyPair.publicKey)
  return await getCrypto().subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export const encryptFileWithWalletEncryptionKey = async ({
  address,
  file,
  keyPair
}: {
  address: `0x${string}`
  file: File
  keyPair: WalletEncryptionKeyPairPayload
}): Promise<WalletEncryptedFilePackage> => {
  const key = await deriveSelfEncryptionKey(keyPair)
  const iv = getRandomIv()
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    await file.arrayBuffer()
  )

  return {
    version: 1,
    kind: 'organigram:wallet-encrypted-file',
    algorithm: 'ECDH-P256+A256GCM',
    recipient: {
      address,
      publicKey: keyPair.publicKey,
      keyVersion: keyPair.keyVersion
    },
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    },
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    encryptedAt: new Date().toISOString()
  }
}

// Authenticates the application origin and recipient with the ciphertext, so a
// payload cannot be decrypted for another application or relabelled for it.
const getEncryptedPayloadAdditionalData = ({
  appOrigin,
  address,
  keyVersion
}: {
  appOrigin: string
  address: string
  keyVersion: number
}): ArrayBuffer =>
  toArrayBuffer(
    textEncoder.encode(
      JSON.stringify([
        'organigram:wallet-encrypted-payload',
        appOrigin,
        address.toLowerCase(),
        keyVersion
      ])
    )
  )

export const encryptPayloadWithWalletEncryptionKey = async ({
  address,
  appOrigin,
  plaintext,
  keyPair
}: {
  address: `0x${string}`
  appOrigin: string
  plaintext: string
  keyPair: WalletEncryptionKeyPairPayload
}): Promise<WalletEncryptedPayload> => {
  const normalizedAppOrigin = new URL(appOrigin).origin
  const key = await deriveSelfEncryptionKey(keyPair)
  const iv = getRandomIv()
  const ciphertext = await getCrypto().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: getEncryptedPayloadAdditionalData({
        appOrigin: normalizedAppOrigin,
        address,
        keyVersion: keyPair.keyVersion
      })
    },
    key,
    textEncoder.encode(plaintext)
  )

  return {
    version: 1,
    kind: 'organigram:wallet-encrypted-payload',
    algorithm: 'ECDH-P256+A256GCM',
    appOrigin: normalizedAppOrigin,
    recipient: {
      address,
      publicKey: keyPair.publicKey,
      keyVersion: keyPair.keyVersion
    },
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    encryptedAt: new Date().toISOString()
  }
}

export const parseWalletEncryptedFilePackage = (
  value: unknown
): WalletEncryptedFilePackage => {
  if (!isPlainObject(value) || !isPlainObject(value.recipient)) {
    throw new Error('Encrypted file package must be an object.')
  }
  if (!isPlainObject(value.file)) {
    throw new Error('Encrypted file package is missing file metadata.')
  }
  if (
    value.version !== 1 ||
    value.kind !== 'organigram:wallet-encrypted-file' ||
    value.algorithm !== 'ECDH-P256+A256GCM' ||
    typeof value.recipient.address !== 'string' ||
    !/^0x[a-fA-F0-9]{40}$/.test(value.recipient.address) ||
    !isJsonWebKey(value.recipient.publicKey) ||
    typeof value.recipient.keyVersion !== 'number' ||
    typeof value.file.name !== 'string' ||
    typeof value.file.type !== 'string' ||
    typeof value.file.size !== 'number' ||
    typeof value.iv !== 'string' ||
    typeof value.ciphertext !== 'string' ||
    typeof value.encryptedAt !== 'string'
  ) {
    throw new Error('Unsupported encrypted file package.')
  }

  return {
    version: 1,
    kind: 'organigram:wallet-encrypted-file',
    algorithm: 'ECDH-P256+A256GCM',
    recipient: {
      address: value.recipient.address as `0x${string}`,
      publicKey: value.recipient.publicKey,
      keyVersion: value.recipient.keyVersion
    },
    file: {
      name: value.file.name,
      type: value.file.type,
      size: value.file.size,
      ...(typeof value.file.lastModified === 'number'
        ? { lastModified: value.file.lastModified }
        : {})
    },
    iv: value.iv,
    ciphertext: value.ciphertext,
    encryptedAt: value.encryptedAt
  }
}

export const parseWalletEncryptedPayload = (
  value: unknown
): WalletEncryptedPayload => {
  if (!isPlainObject(value) || !isPlainObject(value.recipient)) {
    throw new Error('Encrypted payload must be an object.')
  }
  if (
    value.version !== 1 ||
    value.kind !== 'organigram:wallet-encrypted-payload' ||
    value.algorithm !== 'ECDH-P256+A256GCM' ||
    typeof value.appOrigin !== 'string' ||
    typeof value.recipient.address !== 'string' ||
    !/^0x[a-fA-F0-9]{40}$/.test(value.recipient.address) ||
    !isJsonWebKey(value.recipient.publicKey) ||
    typeof value.recipient.keyVersion !== 'number' ||
    typeof value.iv !== 'string' ||
    typeof value.ciphertext !== 'string' ||
    typeof value.encryptedAt !== 'string'
  ) {
    throw new Error('Unsupported encrypted payload.')
  }

  return {
    version: 1,
    kind: 'organigram:wallet-encrypted-payload',
    algorithm: 'ECDH-P256+A256GCM',
    appOrigin: value.appOrigin,
    recipient: {
      address: value.recipient.address as `0x${string}`,
      publicKey: value.recipient.publicKey,
      keyVersion: value.recipient.keyVersion
    },
    iv: value.iv,
    ciphertext: value.ciphertext,
    encryptedAt: value.encryptedAt
  }
}

export const decryptFileWithWalletEncryptionKey = async ({
  encryptedPackage,
  keyPair
}: {
  encryptedPackage: WalletEncryptedFilePackage
  keyPair: WalletEncryptionKeyPairPayload
}): Promise<WalletDecryptedFile> => {
  if (encryptedPackage.recipient.keyVersion !== keyPair.keyVersion) {
    throw new Error('Encrypted file was created for another wallet encryption key.')
  }
  const key = await deriveSelfEncryptionKey(keyPair)
  const plaintext = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64UrlToBytes(encryptedPackage.iv)) },
    key,
    toArrayBuffer(base64UrlToBytes(encryptedPackage.ciphertext))
  )
  const bytes = new Uint8Array(plaintext)
  if (bytes.byteLength !== encryptedPackage.file.size) {
    throw new Error('Decrypted file size does not match package metadata.')
  }

  return {
    name: encryptedPackage.file.name,
    type: encryptedPackage.file.type,
    bytes,
    ...(encryptedPackage.file.lastModified == null
      ? {}
      : { lastModified: encryptedPackage.file.lastModified })
  }
}

export const decryptPayloadWithWalletEncryptionKey = async ({
  encryptedPayload,
  appOrigin,
  keyPair
}: {
  encryptedPayload: WalletEncryptedPayload
  appOrigin: string
  keyPair: WalletEncryptionKeyPairPayload
}): Promise<string> => {
  if (encryptedPayload.recipient.keyVersion !== keyPair.keyVersion) {
    throw new Error('Encrypted payload was created for another wallet encryption key.')
  }
  if (new URL(appOrigin).origin !== encryptedPayload.appOrigin) {
    throw new Error('Encrypted payload was created for another application.')
  }
  const key = await deriveSelfEncryptionKey(keyPair)
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(base64UrlToBytes(encryptedPayload.iv)),
      additionalData: getEncryptedPayloadAdditionalData({
        appOrigin: encryptedPayload.appOrigin,
        address: encryptedPayload.recipient.address,
        keyVersion: encryptedPayload.recipient.keyVersion
      })
    },
    key,
    toArrayBuffer(base64UrlToBytes(encryptedPayload.ciphertext))
  )
  return textDecoder.decode(plaintext)
}
