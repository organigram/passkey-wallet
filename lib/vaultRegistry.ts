import type { StoredVaultAccount, StoredVaultRecord } from './localVault'

/** An account with the passkeys able to unlock it. */
export type WalletGroup = {
  /** Address of the account. */
  address: `0x${string}`
  /** Name of the account. */
  name: string
  /** BIP-44 address index of the account. */
  addressIndex: number
  /** BIP-44 derivation path of the account. */
  derivationPath: string
  /** Vault records holding the account. */
  passkeys: StoredVaultRecord[]
}

/**
 * Vault records holding the same accounts, usually the passkeys of one wallet.
 */
export type VaultRegistryGroup = {
  /** Identifier of the group, from `getVaultRegistryGroupId()`. */
  id: string
  /** Accounts of the group, by address index. */
  accounts: StoredVaultAccount[]
  /** Vault records of the group. */
  passkeys: StoredVaultRecord[]
  /** ISO 8601 date of the oldest record. */
  createdAt: string
}

/**
 * Shorten an address for display, as `0x1234...abcd`.
 *
 * @param address - The address.
 */
export const formatAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`

/**
 * Shorten a passkey identifier longer than 18 characters for display.
 *
 * @param credentialId - The passkey identifier.
 */
export const formatCredentialId = (credentialId: string): string =>
  credentialId.length <= 18
    ? credentialId
    : `${credentialId.slice(0, 8)}...${credentialId.slice(-6)}`

/**
 * Merge imported vault records into local ones, newest first.
 *
 * @remarks
 * An imported record replaces the local record of the same passkey.
 * @param localVaults - The local records.
 * @param importedVaults - The imported records.
 */
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

/**
 * Group vault records by account, ordered by address index.
 *
 * @param vaults - The vault records.
 */
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

/**
 * Identify the set of accounts of a vault record, by address index and address.
 *
 * @param vault - The vault record.
 */
export const getVaultRegistryGroupId = (vault: StoredVaultRecord): string =>
  vault.accounts
    .map(account => `${account.addressIndex}:${account.address.toLowerCase()}`)
    .sort()
    .join('|')

/**
 * Group vault records holding the same accounts, oldest first.
 *
 * @param vaults - The vault records.
 */
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

/**
 * Find an account of a vault record, ignoring the case of the address.
 *
 * @param vault - The vault record.
 * @param address - The address of the account.
 * @returns The account, or `null`.
 */
export const getVaultAccount = (
  vault: StoredVaultRecord,
  address: string
): StoredVaultAccount | null =>
  vault.accounts.find(
    account => account.address.toLowerCase() === address.toLowerCase()
  ) ?? null

/**
 * Get the address index of the next account to derive: one more than the
 * highest index of the records, or 0.
 *
 * @param records - The vault records.
 */
export const getNextAddressIndex = (records: StoredVaultRecord[]): number =>
  Math.max(
    -1,
    ...records.flatMap(record =>
      record.accounts.map(account => account.addressIndex)
    )
  ) + 1
