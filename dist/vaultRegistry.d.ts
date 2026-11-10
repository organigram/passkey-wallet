import type { StoredVaultAccount, StoredVaultRecord } from './localVault';
/** An account with the passkeys able to unlock it. */
export type WalletGroup = {
    /** Address of the account. */
    address: `0x${string}`;
    /** Name of the account. */
    name: string;
    /** BIP-44 address index of the account. */
    addressIndex: number;
    /** BIP-44 derivation path of the account. */
    derivationPath: string;
    /** Vault records holding the account. */
    passkeys: StoredVaultRecord[];
};
/**
 * Vault records holding the same accounts, usually the passkeys of one wallet.
 */
export type VaultRegistryGroup = {
    /** Identifier of the group, from `getVaultRegistryGroupId()`. */
    id: string;
    /** Accounts of the group, by address index. */
    accounts: StoredVaultAccount[];
    /** Vault records of the group. */
    passkeys: StoredVaultRecord[];
    /** ISO 8601 date of the oldest record. */
    createdAt: string;
};
/**
 * Shorten an address for display, as `0x1234...abcd`.
 *
 * @param address - The address.
 */
export declare const formatAddress: (address: string) => string;
/**
 * Shorten a passkey identifier longer than 18 characters for display.
 *
 * @param credentialId - The passkey identifier.
 */
export declare const formatCredentialId: (credentialId: string) => string;
/**
 * Merge imported vault records into local ones, newest first.
 *
 * @remarks
 * An imported record replaces the local record of the same passkey.
 * @param localVaults - The local records.
 * @param importedVaults - The imported records.
 */
export declare const mergeVaults: (localVaults: StoredVaultRecord[], importedVaults: StoredVaultRecord[]) => StoredVaultRecord[];
/**
 * Group vault records by account, ordered by address index.
 *
 * @param vaults - The vault records.
 */
export declare const groupVaultsByWallet: (vaults: StoredVaultRecord[]) => WalletGroup[];
/**
 * Identify the set of accounts of a vault record, by address index and address.
 *
 * @param vault - The vault record.
 */
export declare const getVaultRegistryGroupId: (vault: StoredVaultRecord) => string;
/**
 * Group vault records holding the same accounts, oldest first.
 *
 * @param vaults - The vault records.
 */
export declare const groupVaultRecordsBySeed: (vaults: StoredVaultRecord[]) => VaultRegistryGroup[];
/**
 * Find an account of a vault record, ignoring the case of the address.
 *
 * @param vault - The vault record.
 * @param address - The address of the account.
 * @returns The account, or `null`.
 */
export declare const getVaultAccount: (vault: StoredVaultRecord, address: string) => StoredVaultAccount | null;
/**
 * Get the address index of the next account to derive: one more than the
 * highest index of the records, or 0.
 *
 * @param records - The vault records.
 */
export declare const getNextAddressIndex: (records: StoredVaultRecord[]) => number;
