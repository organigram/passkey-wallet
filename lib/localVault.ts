import type { PasskeyVaultEnvelopeData } from './crypto'

export type StoredVaultAccount = {
  address: `0x${string}`
  name: string
  addressIndex: number
  derivationPath: string
}

export type StoredVaultRecord = {
  version: 1
  address: `0x${string}`
  accounts: StoredVaultAccount[]
  credentialId: string
  rawCredentialId?: string
  name: string
  transports: string[]
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
  createdAt: string
  lastUsedAt: string | null
  envelope: PasskeyVaultEnvelopeData
}

export type VaultRegistry = {
  version: 1
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
    isPasskeyDevice(record.passkeyDevice) &&
    typeof record.createdAt === 'string' &&
    (record.lastUsedAt == null || typeof record.lastUsedAt === 'string') &&
    typeof record.envelope === 'object' &&
    record.envelope != null
  )
}

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

export const createVaultRegistry = (
  vaults: StoredVaultRecord[]
): VaultRegistry => ({
  version: 1,
  vaults
})

export const serializeVaultRegistry = (
  vaults: StoredVaultRecord[],
  space = 2
): string => `${JSON.stringify(createVaultRegistry(vaults), null, space)}\n`

export const vaultHasAccount = (
  vault: StoredVaultRecord,
  address: string
): boolean =>
  vault.accounts.some(
    account => account.address.toLowerCase() === address.toLowerCase()
  )

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

export const removeVaultRecord = ({
  vaults,
  credentialId
}: {
  vaults: StoredVaultRecord[]
  credentialId: string
}): StoredVaultRecord[] =>
  vaults.filter(vault => vault.credentialId !== credentialId)

export const removeVaultRecords = ({
  vaults,
  credentialIds
}: {
  vaults: StoredVaultRecord[]
  credentialIds: Set<string>
}): StoredVaultRecord[] =>
  vaults.filter(vault => !credentialIds.has(vault.credentialId))

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
