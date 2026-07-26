import { getAddress, isAddress } from 'viem';
import { base64UrlToBytes, bytesToBase64Url, getCrypto, randomBytes, textDecoder, textEncoder, toArrayBuffer } from './crypto';
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
    return (record.version === 1 &&
        typeof record.backupId === 'string' &&
        record.backupId !== '' &&
        typeof record.salt === 'string' &&
        record.salt !== '' &&
        typeof record.iv === 'string' &&
        record.iv !== '' &&
        typeof record.ciphertext === 'string' &&
        record.ciphertext !== '' &&
        typeof record.createdAt === 'string' &&
        record.createdAt !== '');
};
export const createRemoteVaultBackupPackage = ({ address, backups }) => ({
    version: 1,
    address: getAddress(address),
    backups,
    exportedAt: new Date().toISOString()
});
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
export const createVaultBackupDigest = async (backups) => {
    const digest = await getCrypto().subtle.digest('SHA-256', textEncoder.encode(stableJsonStringify(backups)));
    return bytesToHex(new Uint8Array(digest));
};
export const createVaultBackupSignatureMessage = ({ address, vaultCount, digest }) => [
    'Organigram Wallet Vault Backup',
    '',
    `Address: ${address}`,
    `Vaults: ${vaultCount}`,
    `Digest: ${digest}`
].join('\n');
const deriveRemoteBackupKey = async ({ address, prfOutput, salt }) => {
    const material = new Uint8Array([
        ...prfOutput,
        ...salt,
        ...textEncoder.encode(`Organigram remote vault backup:${address.toLowerCase()}`)
    ]);
    const digest = await getCrypto().subtle.digest('SHA-256', material);
    return getCrypto().subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt'
    ]);
};
export const createRemoteVaultBackupRecord = async ({ address, record, prfOutput }) => {
    const salt = randomBytes(32);
    const iv = randomBytes(12);
    const key = await deriveRemoteBackupKey({
        address,
        prfOutput,
        salt
    });
    const plaintext = textEncoder.encode(JSON.stringify(record));
    const ciphertext = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext);
    const backupDigest = await getCrypto().subtle.digest('SHA-256', textEncoder.encode(`${address.toLowerCase()}:${record.credentialId}:${bytesToBase64Url(salt)}`));
    return {
        version: 1,
        backupId: bytesToBase64Url(new Uint8Array(backupDigest)),
        salt: bytesToBase64Url(salt),
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
        createdAt: new Date().toISOString()
    };
};
export const decryptRemoteVaultBackupRecord = async ({ address, backup, prfOutput }) => {
    const salt = base64UrlToBytes(backup.salt);
    const iv = base64UrlToBytes(backup.iv);
    const ciphertext = base64UrlToBytes(backup.ciphertext);
    const key = await deriveRemoteBackupKey({
        address,
        prfOutput,
        salt
    });
    const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext));
    return JSON.parse(textDecoder.decode(plaintext));
};
