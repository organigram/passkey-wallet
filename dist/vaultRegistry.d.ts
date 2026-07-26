import type { StoredVaultAccount, StoredVaultRecord } from './localVault';
export type WalletGroup = {
    address: `0x${string}`;
    name: string;
    addressIndex: number;
    derivationPath: string;
    passkeys: StoredVaultRecord[];
};
export type VaultRegistryGroup = {
    id: string;
    accounts: StoredVaultAccount[];
    passkeys: StoredVaultRecord[];
    createdAt: string;
};
export declare const formatAddress: (address: string) => string;
export declare const formatCredentialId: (credentialId: string) => string;
export declare const mergeVaults: (localVaults: StoredVaultRecord[], importedVaults: StoredVaultRecord[]) => StoredVaultRecord[];
export declare const groupVaultsByWallet: (vaults: StoredVaultRecord[]) => WalletGroup[];
export declare const getVaultRegistryGroupId: (vault: StoredVaultRecord) => string;
export declare const groupVaultRecordsBySeed: (vaults: StoredVaultRecord[]) => VaultRegistryGroup[];
export declare const getVaultAccount: (vault: StoredVaultRecord, address: string) => StoredVaultAccount | null;
export declare const getNextAddressIndex: (records: StoredVaultRecord[]) => number;
