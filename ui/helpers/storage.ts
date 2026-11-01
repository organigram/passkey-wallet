import {
  addAccountToVaultRecords,
  isStoredVaultRecord,
  markVaultRecordUsed,
  parseVaultRegistry,
  removeAccountFromVaultRecords,
  removeVaultRecord,
  removeVaultRecords,
  serializeVaultRegistry,
  upsertVaultRecord,
  vaultHasAccount,
  type StoredVaultAccount,
  type StoredVaultRecord,
  type VaultRegistry
} from '@organigram/passkey-wallet/local-vault'

export type { StoredVaultAccount, StoredVaultRecord, VaultRegistry }
export { parseVaultRegistry, vaultHasAccount }

const storageKey = 'passkey-wallet.vaults.v1'
// Vault records this version cannot read, such as version 1 vaults, are kept
// here untouched instead of being dropped by the next save, so that a later
// version can still recover them. Records are only ever appended.
export const archivedVaultsStorageKey = 'passkey-wallet.vaults.archive'

export const defaultStaticVaultRegistry: VaultRegistry = {
  version: 1,
  vaults: []
}

const archiveUnreadableVaults = (registry: unknown): void => {
  const vaults = (registry as { vaults?: unknown } | null)?.vaults
  if (!Array.isArray(vaults)) return
  const unreadable = vaults.filter(vault => !isStoredVaultRecord(vault))
  if (unreadable.length === 0) return

  let archived: unknown[]
  try {
    const raw = window.localStorage.getItem(archivedVaultsStorageKey)
    archived = raw == null || raw === '' ? [] : (JSON.parse(raw) as unknown[])
    if (!Array.isArray(archived)) return
  } catch {
    // Never overwrite an archive that cannot be read back.
    return
  }
  const known = new Set(archived.map(vault => JSON.stringify(vault)))
  const additions = unreadable.filter(vault => !known.has(JSON.stringify(vault)))
  if (additions.length === 0) return

  window.localStorage.setItem(
    archivedVaultsStorageKey,
    JSON.stringify([...archived, ...additions])
  )
}

export const loadLocalVaults = (): StoredVaultRecord[] => {
  const raw = window.localStorage.getItem(storageKey)
  if (raw == null || raw === '') return []

  const registry: unknown = JSON.parse(raw)
  archiveUnreadableVaults(registry)
  return parseVaultRegistry(registry).vaults
}

export const saveLocalVaults = (vaults: StoredVaultRecord[]): void => {
  window.localStorage.setItem(storageKey, serializeVaultRegistry(vaults))
}

export const upsertLocalVault = (
  record: StoredVaultRecord
): StoredVaultRecord[] => {
  const nextVaults = upsertVaultRecord({
    vaults: loadLocalVaults(),
    record
  })
  saveLocalVaults(nextVaults)

  return nextVaults
}

export const addAccountToLocalVaults = ({
  sourceAddress,
  account
}: {
  sourceAddress: `0x${string}`
  account: StoredVaultAccount
}): StoredVaultRecord[] => {
  const nextVaults = addAccountToVaultRecords({
    vaults: loadLocalVaults(),
    sourceAddress,
    account
  })
  saveLocalVaults(nextVaults)

  return nextVaults
}

export const removeLocalVault = (credentialId: string): StoredVaultRecord[] => {
  const nextVaults = removeVaultRecord({
    vaults: loadLocalVaults(),
    credentialId
  })
  saveLocalVaults(nextVaults)

  return nextVaults
}

export const removeLocalVaults = (
  credentialIds: Set<string>
): StoredVaultRecord[] => {
  const nextVaults = removeVaultRecords({
    vaults: loadLocalVaults(),
    credentialIds
  })
  saveLocalVaults(nextVaults)

  return nextVaults
}

export const removeAccountFromLocalVaults = (
  address: `0x${string}`
): StoredVaultRecord[] => {
  const nextVaults = removeAccountFromVaultRecords({
    vaults: loadLocalVaults(),
    address
  })
  saveLocalVaults(nextVaults)

  return nextVaults
}

export const markVaultUsed = (credentialId: string): StoredVaultRecord[] => {
  const nextVaults = markVaultRecordUsed({
    vaults: loadLocalVaults(),
    credentialId
  })
  saveLocalVaults(nextVaults)

  return nextVaults
}
