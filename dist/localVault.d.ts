import type { PasskeyVaultEnvelopeData } from './crypto';
export type StoredVaultAccount = {
    address: `0x${string}`;
    name: string;
    addressIndex: number;
    derivationPath: string;
};
export type StoredVaultRecord = {
    version: 1;
    address: `0x${string}`;
    accounts: StoredVaultAccount[];
    credentialId: string;
    rawCredentialId?: string;
    name: string;
    transports: string[];
    passkeyDevice: {
        kind: 'macos' | 'ios' | 'ipados' | 'windows' | 'android' | 'linux' | 'security-key' | 'cross-device' | 'platform' | 'passkey';
        label: string;
    };
    createdAt: string;
    lastUsedAt: string | null;
    envelope: PasskeyVaultEnvelopeData;
};
export type VaultRegistry = {
    version: 1;
    vaults: StoredVaultRecord[];
};
export declare const isStoredVaultRecord: (value: unknown) => value is StoredVaultRecord;
export declare const parseVaultRegistry: (value: unknown) => VaultRegistry;
export declare const createVaultRegistry: (vaults: StoredVaultRecord[]) => VaultRegistry;
export declare const serializeVaultRegistry: (vaults: StoredVaultRecord[], space?: number) => string;
export declare const vaultHasAccount: (vault: StoredVaultRecord, address: string) => boolean;
export declare const upsertVaultRecord: ({ vaults, record }: {
    vaults: StoredVaultRecord[];
    record: StoredVaultRecord;
}) => StoredVaultRecord[];
export declare const addAccountToVaultRecords: ({ vaults, sourceAddress, account }: {
    vaults: StoredVaultRecord[];
    sourceAddress: `0x${string}`;
    account: StoredVaultAccount;
}) => StoredVaultRecord[];
export declare const removeVaultRecord: ({ vaults, credentialId }: {
    vaults: StoredVaultRecord[];
    credentialId: string;
}) => StoredVaultRecord[];
export declare const removeVaultRecords: ({ vaults, credentialIds }: {
    vaults: StoredVaultRecord[];
    credentialIds: Set<string>;
}) => StoredVaultRecord[];
export declare const removeAccountFromVaultRecords: ({ vaults, address }: {
    vaults: StoredVaultRecord[];
    address: `0x${string}`;
}) => StoredVaultRecord[];
export declare const markVaultRecordUsed: ({ vaults, credentialId, usedAt }: {
    vaults: StoredVaultRecord[];
    credentialId: string;
    usedAt?: string;
}) => StoredVaultRecord[];
