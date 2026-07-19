export const passkeyVaultAlgorithm = 'AES-GCM-HKDF-SHA-256';
export const passkeyVaultKeyVersion = 1;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const getCrypto = () => {
    if (globalThis.crypto == null) {
        throw new Error('WebCrypto is not available in this environment.');
    }
    return globalThis.crypto;
};
const toArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
export const bytesToBase64Url = (bytes) => bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
export const base64UrlToBytes = (value) => {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return base64ToBytes(padded);
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
export const derivePasskeyVaultKey = async ({ prfOutput, salt }) => {
    if (prfOutput.byteLength !== 32) {
        throw new Error('Passkey PRF output must be 32 bytes.');
    }
    if (salt.byteLength !== 32) {
        throw new Error('Passkey vault salt must be 32 bytes.');
    }
    const crypto = getCrypto();
    const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(prfOutput), 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({
        name: 'HKDF',
        hash: 'SHA-256',
        salt: toArrayBuffer(salt),
        info: textEncoder.encode('organigram-passkey-wallet-v1')
    }, baseKey, {
        name: 'AES-GCM',
        length: 256
    }, false, ['encrypt', 'decrypt']);
};
export const encryptPasskeyVaultSecret = async ({ plaintext, key, salt, nonce = getCrypto().getRandomValues(new Uint8Array(12)) }) => {
    if (plaintext.trim() === '') {
        throw new Error('Passkey wallet vault plaintext cannot be empty.');
    }
    const ciphertext = await getCrypto().subtle.encrypt({
        name: 'AES-GCM',
        iv: toArrayBuffer(nonce)
    }, key, textEncoder.encode(plaintext));
    return {
        algorithm: passkeyVaultAlgorithm,
        keyVersion: passkeyVaultKeyVersion,
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
        salt: bytesToBase64Url(salt),
        nonce: bytesToBase64Url(nonce)
    };
};
export const decryptPasskeyVaultSecret = async ({ envelope, key }) => {
    try {
        if (envelope.algorithm !== passkeyVaultAlgorithm) {
            throw new Error('Unsupported passkey wallet vault algorithm.');
        }
        if (envelope.keyVersion !== passkeyVaultKeyVersion) {
            throw new Error('Unsupported passkey wallet vault key version.');
        }
        const plaintext = await getCrypto().subtle.decrypt({
            name: 'AES-GCM',
            iv: toArrayBuffer(base64UrlToBytes(envelope.nonce))
        }, key, toArrayBuffer(base64UrlToBytes(envelope.ciphertext)));
        return textDecoder.decode(plaintext);
    }
    catch (error) {
        throw new Error('Unable to decrypt passkey wallet.', { cause: error });
    }
};
export const isPasskeyPrfSupported = async ({ credential }) => credential?.getClientExtensionResults().prf?.enabled === true;
