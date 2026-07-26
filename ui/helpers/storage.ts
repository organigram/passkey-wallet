import {
  addAccountToVaultRecords,
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

export const defaultStaticVaultRegistry: VaultRegistry = {
  version: 1,
  vaults: []
}

export const loadLocalVaults = (): StoredVaultRecord[] => {
  const raw = window.localStorage.getItem(storageKey)
  if (raw == null || raw === '') return []

  return parseVaultRegistry(JSON.parse(raw)).vaults
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
