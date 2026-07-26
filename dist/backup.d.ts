import type { StoredVaultRecord } from './localVault';
export type RemoteVaultBackupRecord = {
    version: 1;
    backupId: string;
    salt: string;
    iv: string;
    ciphertext: string;
    createdAt: string;
};
export type RemoteVaultBackupPackage = {
    version: 1;
    address: `0x${string}`;
    backups: RemoteVaultBackupRecord[];
    exportedAt: string;
};
export declare const normalizeBackupAddress: (value: string) => `0x${string}`;
export declare const createRemoteVaultBackupPackage: ({ address, backups }: {
    address: `0x${string}`;
    backups: RemoteVaultBackupRecord[];
}) => RemoteVaultBackupPackage;
export declare const parseRemoteVaultBackupPackage: (value: unknown) => RemoteVaultBackupPackage;
export declare const createVaultBackupDigest: (backups: RemoteVaultBackupRecord[]) => Promise<string>;
export declare const createVaultBackupSignatureMessage: ({ address, vaultCount, digest }: {
    address: `0x${string}`;
    vaultCount: number;
    digest: string;
}) => string;
export declare const createRemoteVaultBackupRecord: ({ address, record, prfOutput }: {
    address: `0x${string}`;
    record: StoredVaultRecord;
    prfOutput: Uint8Array;
}) => Promise<RemoteVaultBackupRecord>;
export declare const decryptRemoteVaultBackupRecord: ({ address, backup, prfOutput }: {
    address: `0x${string}`;
    backup: RemoteVaultBackupRecord;
    prfOutput: Uint8Array;
}) => Promise<StoredVaultRecord>;
