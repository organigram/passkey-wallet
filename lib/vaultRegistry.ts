import type { StoredVaultAccount, StoredVaultRecord } from './localVault'

export type WalletGroup = {
  address: `0x${string}`
  name: string
  addressIndex: number
  derivationPath: string
  passkeys: StoredVaultRecord[]
}

export type VaultRegistryGroup = {
  id: string
  accounts: StoredVaultAccount[]
  passkeys: StoredVaultRecord[]
  createdAt: string
}

export const formatAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`

export const formatCredentialId = (credentialId: string): string =>
  credentialId.length <= 18
    ? credentialId
    : `${credentialId.slice(0, 8)}...${credentialId.slice(-6)}`

export const mergeVaults = (
  localVaults: StoredVaultRecord[],
  importedVaults: StoredVaultRecord[]
): StoredVaultRecord[] => {
  const vaults = new Map<string, StoredVaultRecord>()
  localVaults.forEach(vault => vaults.set(vault.credentialId, vault))
  importedVaults.forEach(vault => vaults.set(vault.credentialId, vault))

  return Array.from(vaults.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )
}

export const groupVaultsByWallet = (
  vaults: StoredVaultRecord[]
): WalletGroup[] => {
  const groups = new Map<string, WalletGroup>()

  vaults.forEach(vault => {
    vault.accounts.forEach(account => {
      const key = account.address.toLowerCase()
      const existingGroup = groups.get(key)
      if (existingGroup == null) {
        groups.set(key, {
          address: account.address,
          name: account.name,
          addressIndex: account.addressIndex,
          derivationPath: account.derivationPath,
          passkeys: [vault]
        })
        return
      }

      existingGroup.passkeys.push(vault)
    })
  })

  return Array.from(groups.values()).sort(
    (left, right) => left.addressIndex - right.addressIndex
  )
}

export const getVaultRegistryGroupId = (vault: StoredVaultRecord): string =>
  vault.accounts
    .map(account => `${account.addressIndex}:${account.address.toLowerCase()}`)
    .sort()
    .join('|')

export const groupVaultRecordsBySeed = (
  vaults: StoredVaultRecord[]
): VaultRegistryGroup[] => {
  const groups = new Map<string, VaultRegistryGroup>()

  vaults.forEach(vault => {
    const id = getVaultRegistryGroupId(vault)
    const existingGroup = groups.get(id)
    if (existingGroup == null) {
      groups.set(id, {
        id,
        accounts: [...vault.accounts].sort(
          (left, right) => left.addressIndex - right.addressIndex
        ),
        passkeys: [vault],
        createdAt: vault.createdAt
      })
      return
    }

    existingGroup.passkeys.push(vault)
    if (vault.createdAt.localeCompare(existingGroup.createdAt) < 0) {
      existingGroup.createdAt = vault.createdAt
    }
  })

  return Array.from(groups.values()).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )
}

export const getVaultAccount = (
  vault: StoredVaultRecord,
  address: string
): StoredVaultAccount | null =>
  vault.accounts.find(
    account => account.address.toLowerCase() === address.toLowerCase()
  ) ?? null

export const getNextAddressIndex = (records: StoredVaultRecord[]): number =>
  Math.max(
    -1,
    ...records.flatMap(record =>
      record.accounts.map(account => account.addressIndex)
    )
  ) + 1
