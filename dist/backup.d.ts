import { type PasskeyVaultEnvelopeData } from './crypto';
import type { StoredVaultRecord } from './localVault';
/**
 * A vault record encrypted for backup on a server.
 *
 * @remarks
 * A backup exposes its vault envelope, which only its own passkey can decrypt,
 * with the identifier of that passkey. The rest of the vault record (account
 * addresses, names, devices) is encrypted with a key derived from the recovery
 * phrase, so that any passkey of the wallet can restore every backup while the
 * server learns nothing beyond the wallet address.
 */
export type RemoteVaultBackupRecord = {
    /** Version of the format. */
    version: 2;
    /**
     * Identifier of the backup, a hash of the address, the passkey and the salt.
     */
    backupId: string;
    /** Raw identifier of the passkey of the envelope, in base64url. */
    credentialId: string;
    /** Vault envelope, which only its passkey can decrypt. */
    envelope: PasskeyVaultEnvelopeData;
    /** Random 32-byte salt of the backup key, in base64url. */
    salt: string;
    /** 12-byte AES-GCM nonce, in base64url. */
    iv: string;
    /** Encrypted vault record, in base64url. */
    ciphertext: string;
    /** ISO 8601 date of the backup. */
    createdAt: string;
};
/** The backups of a wallet, as exported or restored. */
export type RemoteVaultBackupPackage = {
    /** Version of the format. */
    version: 1;
    /** Address of the wallet. */
    address: `0x${string}`;
    /** The backups. */
    backups: RemoteVaultBackupRecord[];
    /** ISO 8601 date of the export. */
    exportedAt: string;
};
/**
 * Check and checksum an address typed by a user to restore backups.
 *
 * @param value - The address.
 * @throws When the value is not an address.
 */
export declare const normalizeBackupAddress: (value: string) => `0x${string}`;
/**
 * Wrap the backups of a wallet in a package.
 *
 * @param input - The address of the wallet and its backups.
 */
export declare const createRemoteVaultBackupPackage: ({ address, backups }: {
    address: `0x${string}`;
    backups: RemoteVaultBackupRecord[];
}) => RemoteVaultBackupPackage;
/**
 * Read a backup package.
 *
 * @param value - The package, parsed from JSON.
 * @throws When the package is invalid, empty, or of an unsupported version.
 */
export declare const parseRemoteVaultBackupPackage: (value: unknown) => RemoteVaultBackupPackage;
/**
 * Hash backups with SHA-256, over a JSON serialization with sorted keys.
 *
 * @param backups - The backups.
 * @returns The digest, in hex.
 */
export declare const createVaultBackupDigest: (backups: RemoteVaultBackupRecord[]) => Promise<string>;
/**
 * Build the message the wallet signs to authorize storing backups.
 *
 * @param input - The address of the wallet, the number of backups and their
 * digest from `createVaultBackupDigest()`.
 */
export declare const createVaultBackupSignatureMessage: ({ address, vaultCount, digest }: {
    address: `0x${string}`;
    vaultCount: number;
    digest: string;
}) => string;
/**
 * Encrypt a vault record for backup.
 *
 * @remarks
 * The backup key is derived with HKDF from a SHA-256 hash of the recovery
 * phrase, a random salt, and the address. The recovery phrase itself is never
 * part of the backup.
 * @param input - The address of the wallet, the vault record and the recovery
 * phrase of the wallet.
 */
export declare const createRemoteVaultBackupRecord: ({ address, record, recoveryPhrase }: {
    address: `0x${string}`;
    record: StoredVaultRecord;
    recoveryPhrase: string;
}) => Promise<RemoteVaultBackupRecord>;
/**
 * Decrypt a vault record from a backup.
 *
 * @remarks
 * The result is not validated: check it with `isStoredVaultRecord()` before
 * use.
 * @param input - The address of the wallet, the backup and the recovery phrase
 * of the wallet.
 * @throws When the recovery phrase or address is not the one of the backup.
 */
export declare const decryptRemoteVaultBackupRecord: ({ address, backup, recoveryPhrase }: {
    address: `0x${string}`;
    backup: RemoteVaultBackupRecord;
    recoveryPhrase: string;
}) => Promise<StoredVaultRecord>;
