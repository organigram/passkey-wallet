/**
 * Algorithm of passkey vaults: AES-256-GCM with a key derived by HKDF-SHA-256
 * from the passkey PRF output.
 */
export const passkeyVaultAlgorithm = 'AES-GCM-HKDF-SHA-256';
/** Version of the key derivation of passkey vaults. */
export const passkeyVaultKeyVersion = 2;
/** Shared UTF-8 encoder. */
export const textEncoder = new TextEncoder();
/** Shared UTF-8 decoder. */
export const textDecoder = new TextDecoder();
/**
 * Get the Web Crypto API of the environment.
 *
 * @throws When Web Crypto is not available.
 */
export const getCrypto = () => {
    if (globalThis.crypto?.subtle == null) {
        throw new Error('WebCrypto is not available in this environment.');
    }
    return globalThis.crypto;
};
/**
 * Copy the bytes of a view into a new `ArrayBuffer`.
 *
 * @param bytes - The bytes to copy.
 */
export const toArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
/**
 * Generate cryptographically secure random bytes.
 *
 * @param length - Number of bytes.
 */
export const randomBytes = (length) => getCrypto().getRandomValues(new Uint8Array(length));
/**
 * Encode bytes in unpadded base64url.
 *
 * @param bytes - The bytes to encode.
 */
export const bytesToBase64Url = (bytes) => bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
/**
 * Decode unpadded base64url.
 *
 * @remarks
 * Accepts canonical unpadded base64url only. Lenient decoders silently skip
 * unknown characters, so a tampered value could otherwise decode to bytes other
 * than the ones it appears to encode.
 * @param value - The value to decode.
 * @throws When the value is not canonical unpadded base64url.
 */
export const base64UrlToBytes = (value) => {
    if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
        throw new Error('Value must be base64url.');
    }
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const bytes = base64ToBytes(padded);
    if (bytesToBase64Url(bytes) !== value) {
        throw new Error('Value must be canonical base64url.');
    }
    return bytes;
};
/**
 * Check that a value is canonical base64url whose decoded length passes a test.
 *
 * @param value - The value to check.
 * @param isValidLength - Test of the decoded length, in bytes.
 */
export const hasBase64UrlByteLength = (value, isValidLength) => {
    if (typeof value !== 'string')
        return false;
    try {
        return isValidLength(base64UrlToBytes(value).byteLength);
    }
    catch {
        return false;
    }
};
/**
 * Check that a value is a passkey vault envelope of the current algorithm and
 * key version, with salts, nonce and ciphertext of valid lengths.
 *
 * @param value - The value to check.
 */
export const isPasskeyVaultEnvelope = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const envelope = value;
    return (envelope.algorithm === passkeyVaultAlgorithm &&
        envelope.keyVersion === passkeyVaultKeyVersion &&
        hasBase64UrlByteLength(envelope.salt, length => length === 32) &&
        hasBase64UrlByteLength(envelope.prfSalt, length => length === 32) &&
        hasBase64UrlByteLength(envelope.nonce, length => length === 12) &&
        hasBase64UrlByteLength(envelope.ciphertext, length => length > 16));
};
const bytesToBase64 = (bytes) => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};
const base64ToBytes = (value) => {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(value, 'base64'));
    }
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};
/**
 * Derive the AES-GCM key of a vault from the PRF output of a passkey.
 *
 * @remarks
 * The key cannot be exported. A copy of the PRF output made for the import is
 * zeroed afterwards, but not the original: zero it once you no longer need it.
 * @param input - The 32-byte PRF output, the 32-byte salt of the vault, and an
 * optional HKDF `info` that separates keys derived from the same PRF output for
 * different purposes.
 * @throws When the PRF output or the salt is not 32 bytes.
 */
export const derivePasskeyVaultKey = async ({ prfOutput, salt, info = 'organigram-passkey-wallet-v2' }) => {
    if (prfOutput.byteLength !== 32) {
        throw new Error('Passkey PRF output must be 32 bytes.');
    }
    if (salt.byteLength !== 32) {
        throw new Error('Passkey vault salt must be 32 bytes.');
    }
    const crypto = getCrypto();
    // toArrayBuffer copies the PRF output; the copy is zeroed like the original.
    const keyMaterial = toArrayBuffer(prfOutput);
    const baseKey = await crypto.subtle
        .importKey('raw', keyMaterial, 'HKDF', false, ['deriveKey'])
        .finally(() => new Uint8Array(keyMaterial).fill(0));
    return await crypto.subtle.deriveKey({
        name: 'HKDF',
        hash: 'SHA-256',
        salt: toArrayBuffer(salt),
        info: textEncoder.encode(info)
    }, baseKey, {
        name: 'AES-GCM',
        length: 256
    }, false, ['encrypt', 'decrypt']);
};
/**
 * Encrypt a secret with a vault key into a vault envelope.
 *
 * @param input - The secret, the key from `derivePasskeyVaultKey()`, the salt
 * it was derived with, the 32-byte PRF salt, and an optional 12-byte nonce,
 * random by default. Never reuse a nonce with the same key.
 * @throws When the secret is empty or the PRF salt is not 32 bytes.
 */
export const encryptPasskeyVaultSecret = async ({ plaintext, key, salt, prfSalt, nonce = randomBytes(12) }) => {
    if (plaintext.trim() === '') {
        throw new Error('Passkey wallet vault plaintext cannot be empty.');
    }
    if (prfSalt.byteLength !== 32) {
        throw new Error('Passkey PRF salt must be 32 bytes.');
    }
    const plaintextBytes = textEncoder.encode(plaintext);
    try {
        const ciphertext = await getCrypto().subtle.encrypt({
            name: 'AES-GCM',
            iv: toArrayBuffer(nonce)
        }, key, plaintextBytes);
        return {
            algorithm: passkeyVaultAlgorithm,
            keyVersion: passkeyVaultKeyVersion,
            ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
            salt: bytesToBase64Url(salt),
            prfSalt: bytesToBase64Url(prfSalt),
            nonce: bytesToBase64Url(nonce)
        };
    }
    finally {
        plaintextBytes.fill(0);
    }
};
/**
 * Decrypt the secret of a vault envelope.
 *
 * @param input - The envelope and the key derived for it.
 * @throws When the algorithm or key version is not supported, or the key or
 * envelope is wrong.
 */
export const decryptPasskeyVaultSecret = async ({ envelope, key }) => {
    try {
        if (envelope.algorithm !== passkeyVaultAlgorithm) {
            throw new Error('Unsupported passkey wallet vault algorithm.');
        }
        if (envelope.keyVersion !== passkeyVaultKeyVersion) {
            throw new Error('Unsupported passkey wallet vault key version.');
        }
        const plaintext = new Uint8Array(await getCrypto().subtle.decrypt({
            name: 'AES-GCM',
            iv: toArrayBuffer(base64UrlToBytes(envelope.nonce))
        }, key, toArrayBuffer(base64UrlToBytes(envelope.ciphertext))));
        try {
            return textDecoder.decode(plaintext);
        }
        finally {
            plaintext.fill(0);
        }
    }
    catch (error) {
        throw new Error('Unable to decrypt passkey wallet.', { cause: error });
    }
};
/**
 * Check whether a newly created passkey enabled the PRF extension, which the
 * wallet needs to derive its keys.
 *
 * @param input - The credential returned by `navigator.credentials.create()`.
 */
export const isPasskeyPrfSupported = async ({ credential }) => credential?.getClientExtensionResults().prf?.enabled === true;
