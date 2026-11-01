import { type PasskeyVaultEnvelopeData } from './crypto';
import type { StoredVaultRecord } from './localVault';
export type RemoteVaultBackupRecord = {
    version: 2;
    backupId: string;
    credentialId: string;
    envelope: PasskeyVaultEnvelopeData;
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
export declare const createRemoteVaultBackupRecord: ({ address, record, recoveryPhrase }: {
    address: `0x${string}`;
    record: StoredVaultRecord;
    recoveryPhrase: string;
}) => Promise<RemoteVaultBackupRecord>;
export declare const decryptRemoteVaultBackupRecord: ({ address, backup, recoveryPhrase }: {
    address: `0x${string}`;
    backup: RemoteVaultBackupRecord;
    recoveryPhrase: string;
}) => Promise<StoredVaultRecord>;
