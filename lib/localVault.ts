import { isPasskeyVaultEnvelope, type PasskeyVaultEnvelopeData } from './crypto'

/** An account of a wallet, derived from its recovery phrase. */
export type StoredVaultAccount = {
  /** Address of the account. */
  address: `0x${string}`
  /** Name of the account. */
  name: string
  /** BIP-44 address index of the account. */
  addressIndex: number
  /**
   * BIP-44 derivation path of the account, as returned by
   * `getDerivationPath()`.
   */
  derivationPath: string
}

/**
 * A wallet vault encrypted for one passkey, with the public details needed to
 * unlock it.
 *
 * @remarks
 * A wallet has one record per passkey that can unlock it. The record holds no
 * secret in clear: only its passkey can decrypt the envelope.
 */
export type StoredVaultRecord = {
  /** Version of the record format. */
  version: 1
  /** Address of the first account of the vault. */
  address: `0x${string}`
  /** Accounts of the wallet unlocked by this passkey, never empty. */
  accounts: StoredVaultAccount[]
  /** Identifier of the passkey. */
  credentialId: string
  /**
   * Raw identifier of the passkey, in base64url, when it differs from
   * `credentialId`.
   */
  rawCredentialId?: string
  /** Name of the vault. */
  name: string
  /** WebAuthn transports of the passkey, to suggest how to reach it. */
  transports: string[]
  /**
   * Kind and label of the device holding the passkey, guessed when it was
   * registered.
   */
  passkeyDevice: {
    kind:
      | 'macos'
      | 'ios'
      | 'ipados'
      | 'windows'
      | 'android'
      | 'linux'
      | 'security-key'
      | 'cross-device'
      | 'platform'
      | 'passkey'
    label: string
  }
  /** ISO 8601 date of the registration. */
  createdAt: string
  /** ISO 8601 date of the last unlock, if any. */
  lastUsedAt: string | null
  /** The encrypted recovery phrase and wallet encryption key. */
  envelope: PasskeyVaultEnvelopeData
}

/** A list of vault records, as stored or exported. */
export type VaultRegistry = {
  /** Version of the registry format. */
  version: 1
  /** The vault records. */
  vaults: StoredVaultRecord[]
}

const passkeyDeviceKinds = new Set<StoredVaultRecord['passkeyDevice']['kind']>([
  'macos',
  'ios',
  'ipados',
  'windows',
  'android',
  'linux',
  'security-key',
  'cross-device',
  'platform',
  'passkey'
])

const isPasskeyDevice = (
  value: unknown
): value is StoredVaultRecord['passkeyDevice'] => {
  if (typeof value !== 'object' || value == null) return false

  const device = value as Partial<StoredVaultRecord['passkeyDevice']>
  return (
    typeof device.kind === 'string' &&
    passkeyDeviceKinds.has(
      device.kind as StoredVaultRecord['passkeyDevice']['kind']
    ) &&
    typeof device.label === 'string' &&
    device.label.trim() !== ''
  )
}

const isStoredVaultAccount = (value: unknown): value is StoredVaultAccount => {
  if (typeof value !== 'object' || value == null) return false

  const account = value as Partial<StoredVaultAccount>
  return (
    typeof account.address === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(account.address) &&
    typeof account.name === 'string' &&
    typeof account.addressIndex === 'number' &&
    Number.isInteger(account.addressIndex) &&
    account.addressIndex >= 0 &&
    typeof account.derivationPath === 'string' &&
    account.derivationPath !== ''
  )
}

/**
 * Check that a value is a valid vault record.
 *
 * @param value - The value to check.
 */
export const isStoredVaultRecord = (
  value: unknown
): value is StoredVaultRecord => {
  if (typeof value !== 'object' || value == null) return false

  const record = value as Partial<StoredVaultRecord>
  return (
    record.version === 1 &&
    typeof record.address === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(record.address) &&
    Array.isArray(record.accounts) &&
    record.accounts.length > 0 &&
    record.accounts.every(isStoredVaultAccount) &&
    typeof record.credentialId === 'string' &&
    record.credentialId !== '' &&
    typeof record.name === 'string' &&
    Array.isArray(record.transports) &&
    record.transports.every(transport => typeof transport === 'string') &&
    isPasskeyDevice(record.passkeyDevice) &&
    typeof record.createdAt === 'string' &&
    (record.lastUsedAt == null || typeof record.lastUsedAt === 'string') &&
    isPasskeyVaultEnvelope(record.envelope)
  )
}

/**
 * Read a vault registry, dropping invalid records.
 *
 * @param value - The registry, parsed from JSON.
 * @throws When the value is not a registry of a supported version.
 */
export const parseVaultRegistry = (value: unknown): VaultRegistry => {
  if (typeof value !== 'object' || value == null) {
    throw new Error('Vault registry must be a JSON object.')
  }

  const registry = value as Partial<VaultRegistry>
  if (registry.version !== 1 || !Array.isArray(registry.vaults)) {
    throw new Error('Unsupported vault registry format.')
  }

  return {
    version: 1,
    vaults: registry.vaults.filter(isStoredVaultRecord)
  }
}

/**
 * Wrap vault records in a registry.
 *
 * @param vaults - The vault records.
 */
export const createVaultRegistry = (
  vaults: StoredVaultRecord[]
): VaultRegistry => ({
  version: 1,
  vaults
})

/**
 * Serialize vault records as a registry in JSON.
 *
 * @param vaults - The vault records.
 * @param space - Indentation of the JSON.
 */
export const serializeVaultRegistry = (
  vaults: StoredVaultRecord[],
  space = 2
): string => `${JSON.stringify(createVaultRegistry(vaults), null, space)}\n`

/**
 * Check whether a vault holds an account, ignoring the case of the address.
 *
 * @param vault - The vault record.
 * @param address - The address of the account.
 */
export const vaultHasAccount = (
  vault: StoredVaultRecord,
  address: string
): boolean =>
  vault.accounts.some(
    account => account.address.toLowerCase() === address.toLowerCase()
  )

/**
 * Add a vault record, or replace the record of the same passkey, and put it
 * first.
 *
 * @param input - The vault records and the record to add.
 */
export const upsertVaultRecord = ({
  vaults,
  record
}: {
  vaults: StoredVaultRecord[]
  record: StoredVaultRecord
}): StoredVaultRecord[] => [
  record,
  ...vaults.filter(vault => vault.credentialId !== record.credentialId)
]

/**
 * Add an account to every vault of the wallet that holds another account.
 *
 * @param input - The vault records, an account the wallet already holds, and
 * the account to add.
 */
export const addAccountToVaultRecords = ({
  vaults,
  sourceAddress,
  account
}: {
  vaults: StoredVaultRecord[]
  sourceAddress: `0x${string}`
  account: StoredVaultAccount
}): StoredVaultRecord[] =>
  vaults.map(vault =>
    vaultHasAccount(vault, sourceAddress)
      ? {
          ...vault,
          accounts: vaultHasAccount(vault, account.address)
            ? vault.accounts
            : [...vault.accounts, account].sort(
                (left, right) => left.addressIndex - right.addressIndex
              )
        }
      : vault
  )

/**
 * Remove the vault record of a passkey.
 *
 * @param input - The vault records and the identifier of the passkey.
 */
export const removeVaultRecord = ({
  vaults,
  credentialId
}: {
  vaults: StoredVaultRecord[]
  credentialId: string
}): StoredVaultRecord[] =>
  vaults.filter(vault => vault.credentialId !== credentialId)

/**
 * Remove the vault records of several passkeys.
 *
 * @param input - The vault records and the identifiers of the passkeys.
 */
export const removeVaultRecords = ({
  vaults,
  credentialIds
}: {
  vaults: StoredVaultRecord[]
  credentialIds: Set<string>
}): StoredVaultRecord[] =>
  vaults.filter(vault => !credentialIds.has(vault.credentialId))

/**
 * Remove an account from every vault, and the vaults left without accounts.
 *
 * @remarks
 * This only removes local records. Without a remaining vault or exported
 * recovery phrase, the account can no longer be unlocked.
 * @param input - The vault records and the address of the account.
 */
export const removeAccountFromVaultRecords = ({
  vaults,
  address
}: {
  vaults: StoredVaultRecord[]
  address: `0x${string}`
}): StoredVaultRecord[] =>
  vaults
    .map(vault => ({
      ...vault,
      accounts: vault.accounts.filter(
        account => account.address.toLowerCase() !== address.toLowerCase()
      )
    }))
    .filter(vault => vault.accounts.length > 0)

/**
 * Set the date of the last unlock of a vault.
 *
 * @param input - The vault records, the identifier of the passkey, and the
 * date, now by default.
 */
export const markVaultRecordUsed = ({
  vaults,
  credentialId,
  usedAt = new Date().toISOString()
}: {
  vaults: StoredVaultRecord[]
  credentialId: string
  usedAt?: string
}): StoredVaultRecord[] =>
  vaults.map(vault =>
    vault.credentialId === credentialId
      ? {
          ...vault,
          lastUsedAt: usedAt
        }
      : vault
  )
