import { getAddress, isAddress } from 'viem';
import { base64UrlToBytes, bytesToBase64Url, derivePasskeyVaultKey, getCrypto, hasBase64UrlByteLength, isPasskeyVaultEnvelope, randomBytes, textDecoder, textEncoder, toArrayBuffer } from './crypto';
/**
 * Check and checksum an address typed by a user to restore backups.
 *
 * @param value - The address.
 * @throws When the value is not an address.
 */
export const normalizeBackupAddress = (value) => {
    const trimmed = value.trim();
    if (!isAddress(trimmed)) {
        throw new Error('Enter a valid wallet address to restore remote vaults.');
    }
    return getAddress(trimmed);
};
const isRemoteVaultBackupRecord = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const record = value;
    return (record.version === 2 &&
        typeof record.backupId === 'string' &&
        record.backupId !== '' &&
        hasBase64UrlByteLength(record.credentialId, length => length > 0) &&
        isPasskeyVaultEnvelope(record.envelope) &&
        hasBase64UrlByteLength(record.salt, length => length === 32) &&
        hasBase64UrlByteLength(record.iv, length => length === 12) &&
        hasBase64UrlByteLength(record.ciphertext, length => length > 16) &&
        typeof record.createdAt === 'string' &&
        record.createdAt !== '');
};
/**
 * Wrap the backups of a wallet in a package.
 *
 * @param input - The address of the wallet and its backups.
 */
export const createRemoteVaultBackupPackage = ({ address, backups }) => ({
    version: 1,
    address: getAddress(address),
    backups,
    exportedAt: new Date().toISOString()
});
/**
 * Read a backup package.
 *
 * @param value - The package, parsed from JSON.
 * @throws When the package is invalid, empty, or of an unsupported version.
 */
export const parseRemoteVaultBackupPackage = (value) => {
    if (typeof value !== 'object' || value == null) {
        throw new Error('Encrypted backup must be a JSON object.');
    }
    const backup = value;
    if (backup.version !== 1 ||
        typeof backup.address !== 'string' ||
        !isAddress(backup.address) ||
        !Array.isArray(backup.backups) ||
        backup.backups.length === 0 ||
        !backup.backups.every(isRemoteVaultBackupRecord)) {
        throw new Error('Unsupported encrypted backup format.');
    }
    return {
        version: 1,
        address: getAddress(backup.address),
        backups: backup.backups,
        exportedAt: typeof backup.exportedAt === 'string' && backup.exportedAt !== ''
            ? backup.exportedAt
            : new Date().toISOString()
    };
};
const stableJsonStringify = (value) => {
    if (Array.isArray(value)) {
        return `[${value.map(stableJsonStringify).join(',')}]`;
    }
    if (typeof value === 'object' && value != null) {
        return `{${Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
};
const bytesToHex = (bytes) => Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
/**
 * Hash backups with SHA-256, over a JSON serialization with sorted keys.
 *
 * @param backups - The backups.
 * @returns The digest, in hex.
 */
export const createVaultBackupDigest = async (backups) => {
    const digest = await getCrypto().subtle.digest('SHA-256', textEncoder.encode(stableJsonStringify(backups)));
    return bytesToHex(new Uint8Array(digest));
};
/**
 * Build the message the wallet signs to authorize storing backups.
 *
 * @param input - The address of the wallet, the number of backups and their
 * digest from `createVaultBackupDigest()`.
 */
export const createVaultBackupSignatureMessage = ({ address, vaultCount, digest }) => [
    'Organigram Wallet Vault Backup',
    '',
    `Address: ${address}`,
    `Vaults: ${vaultCount}`,
    `Digest: ${digest}`
].join('\n');
const deriveRemoteBackupKey = async ({ address, recoveryPhrase, salt }) => {
    const phraseBytes = textEncoder.encode(recoveryPhrase);
    const keyMaterial = new Uint8Array(await getCrypto().subtle.digest('SHA-256', phraseBytes));
    phraseBytes.fill(0);
    try {
        return await derivePasskeyVaultKey({
            prfOutput: keyMaterial,
            salt,
            info: `organigram-passkey-wallet-remote-backup-v2:${address.toLowerCase()}`
        });
    }
    finally {
        keyMaterial.fill(0);
    }
};
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
export const createRemoteVaultBackupRecord = async ({ address, record, recoveryPhrase }) => {
    const salt = randomBytes(32);
    const iv = randomBytes(12);
    const key = await deriveRemoteBackupKey({
        address,
        recoveryPhrase,
        salt
    });
    const plaintext = textEncoder.encode(JSON.stringify(record));
    const ciphertext = await getCrypto()
        .subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext)
        .finally(() => plaintext.fill(0));
    const backupDigest = await getCrypto().subtle.digest('SHA-256', textEncoder.encode(`${address.toLowerCase()}:${record.credentialId}:${bytesToBase64Url(salt)}`));
    return {
        version: 2,
        backupId: bytesToBase64Url(new Uint8Array(backupDigest)),
        credentialId: record.rawCredentialId ?? record.credentialId,
        envelope: record.envelope,
        salt: bytesToBase64Url(salt),
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
        createdAt: new Date().toISOString()
    };
};
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
export const decryptRemoteVaultBackupRecord = async ({ address, backup, recoveryPhrase }) => {
    const salt = base64UrlToBytes(backup.salt);
    const iv = base64UrlToBytes(backup.iv);
    const ciphertext = base64UrlToBytes(backup.ciphertext);
    const key = await deriveRemoteBackupKey({
        address,
        recoveryPhrase,
        salt
    });
    const plaintext = new Uint8Array(await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext)));
    try {
        return JSON.parse(textDecoder.decode(plaintext));
    }
    finally {
        plaintext.fill(0);
    }
};
