import { getAddress, isAddress } from 'viem'

import {
  base64UrlToBytes,
  bytesToBase64Url,
  derivePasskeyVaultKey,
  getCrypto,
  hasBase64UrlByteLength,
  isPasskeyVaultEnvelope,
  randomBytes,
  textDecoder,
  textEncoder,
  toArrayBuffer,
  type PasskeyVaultEnvelopeData
} from './crypto'
import type { StoredVaultRecord } from './localVault'

// A backup exposes its vault envelope, which only its own passkey can
// decrypt, with that passkey's credential ID. The rest of the vault record
// (account addresses, names, devices) is encrypted with a key derived from
// the recovery phrase, so any passkey of the wallet can restore every backup
// while Organigram learns nothing beyond the wallet address.
export type RemoteVaultBackupRecord = {
  version: 2
  backupId: string
  credentialId: string
  envelope: PasskeyVaultEnvelopeData
  salt: string
  iv: string
  ciphertext: string
  createdAt: string
}

export type RemoteVaultBackupPackage = {
  version: 1
  address: `0x${string}`
  backups: RemoteVaultBackupRecord[]
  exportedAt: string
}

export const normalizeBackupAddress = (value: string): `0x${string}` => {
  const trimmed = value.trim()
  if (!isAddress(trimmed)) {
    throw new Error('Enter a valid wallet address to restore remote vaults.')
  }

  return getAddress(trimmed as `0x${string}`)
}

const isRemoteVaultBackupRecord = (
  value: unknown
): value is RemoteVaultBackupRecord => {
  if (typeof value !== 'object' || value == null) return false

  const record = value as Partial<RemoteVaultBackupRecord>
  return (
    record.version === 2 &&
    typeof record.backupId === 'string' &&
    record.backupId !== '' &&
    hasBase64UrlByteLength(record.credentialId, length => length > 0) &&
    isPasskeyVaultEnvelope(record.envelope) &&
    hasBase64UrlByteLength(record.salt, length => length === 32) &&
    hasBase64UrlByteLength(record.iv, length => length === 12) &&
    hasBase64UrlByteLength(record.ciphertext, length => length > 16) &&
    typeof record.createdAt === 'string' &&
    record.createdAt !== ''
  )
}

export const createRemoteVaultBackupPackage = ({
  address,
  backups
}: {
  address: `0x${string}`
  backups: RemoteVaultBackupRecord[]
}): RemoteVaultBackupPackage => ({
  version: 1,
  address: getAddress(address),
  backups,
  exportedAt: new Date().toISOString()
})

export const parseRemoteVaultBackupPackage = (
  value: unknown
): RemoteVaultBackupPackage => {
  if (typeof value !== 'object' || value == null) {
    throw new Error('Encrypted backup must be a JSON object.')
  }

  const backup = value as Partial<RemoteVaultBackupPackage>
  if (
    backup.version !== 1 ||
    typeof backup.address !== 'string' ||
    !isAddress(backup.address) ||
    !Array.isArray(backup.backups) ||
    backup.backups.length === 0 ||
    !backup.backups.every(isRemoteVaultBackupRecord)
  ) {
    throw new Error('Unsupported encrypted backup format.')
  }

  return {
    version: 1,
    address: getAddress(backup.address),
    backups: backup.backups,
    exportedAt:
      typeof backup.exportedAt === 'string' && backup.exportedAt !== ''
        ? backup.exportedAt
        : new Date().toISOString()
  }
}

const stableJsonStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`
  }
  if (typeof value === 'object' && value != null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${stableJsonStringify(item)}`
      )
      .join(',')}}`
  }

  return JSON.stringify(value)
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

export const createVaultBackupDigest = async (
  backups: RemoteVaultBackupRecord[]
): Promise<string> => {
  const digest = await getCrypto().subtle.digest(
    'SHA-256',
    textEncoder.encode(stableJsonStringify(backups))
  )

  return bytesToHex(new Uint8Array(digest))
}

export const createVaultBackupSignatureMessage = ({
  address,
  vaultCount,
  digest
}: {
  address: `0x${string}`
  vaultCount: number
  digest: string
}): string =>
  [
    'Organigram Wallet Vault Backup',
    '',
    `Address: ${address}`,
    `Vaults: ${vaultCount}`,
    `Digest: ${digest}`
  ].join('\n')

const deriveRemoteBackupKey = async ({
  address,
  recoveryPhrase,
  salt
}: {
  address: `0x${string}`
  recoveryPhrase: string
  salt: Uint8Array
}): Promise<CryptoKey> => {
  const phraseBytes = textEncoder.encode(recoveryPhrase)
  const keyMaterial = new Uint8Array(
    await getCrypto().subtle.digest('SHA-256', phraseBytes)
  )
  phraseBytes.fill(0)

  try {
    return await derivePasskeyVaultKey({
      prfOutput: keyMaterial,
      salt,
      info: `organigram-passkey-wallet-remote-backup-v2:${address.toLowerCase()}`
    })
  } finally {
    keyMaterial.fill(0)
  }
}

export const createRemoteVaultBackupRecord = async ({
  address,
  record,
  recoveryPhrase
}: {
  address: `0x${string}`
  record: StoredVaultRecord
  recoveryPhrase: string
}): Promise<RemoteVaultBackupRecord> => {
  const salt = randomBytes(32)
  const iv = randomBytes(12)
  const key = await deriveRemoteBackupKey({
    address,
    recoveryPhrase,
    salt
  })
  const plaintext = textEncoder.encode(JSON.stringify(record))
  const ciphertext = await getCrypto()
    .subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext)
    .finally(() => plaintext.fill(0))
  const backupDigest = await getCrypto().subtle.digest(
    'SHA-256',
    textEncoder.encode(
      `${address.toLowerCase()}:${record.credentialId}:${bytesToBase64Url(salt)}`
    )
  )

  return {
    version: 2,
    backupId: bytesToBase64Url(new Uint8Array(backupDigest)),
    credentialId: record.rawCredentialId ?? record.credentialId,
    envelope: record.envelope,
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString()
  }
}

export const decryptRemoteVaultBackupRecord = async ({
  address,
  backup,
  recoveryPhrase
}: {
  address: `0x${string}`
  backup: RemoteVaultBackupRecord
  recoveryPhrase: string
}): Promise<StoredVaultRecord> => {
  const salt = base64UrlToBytes(backup.salt)
  const iv = base64UrlToBytes(backup.iv)
  const ciphertext = base64UrlToBytes(backup.ciphertext)
  const key = await deriveRemoteBackupKey({
    address,
    recoveryPhrase,
    salt
  })
  const plaintext = new Uint8Array(
    await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    )
  )

  try {
    return JSON.parse(textDecoder.decode(plaintext)) as StoredVaultRecord
  } finally {
    plaintext.fill(0)
  }
}
