import { base64UrlToBytes, bytesToBase64Url, getCrypto, randomBytes, textDecoder, textEncoder, toArrayBuffer } from './crypto';
const walletFileIvLength = 12;
const walletKeyAlgorithm = { name: 'ECDH', namedCurve: 'P-256' };
const encryptionPublicKeyResourceKind = 'organigram.encryption-public-key.v1';
const encryptionPublicKeyResourcePrefix = 'urn:organigram:encryption-public-key:';
const isPlainObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const isJsonWebKey = (value) => isPlainObject(value) && typeof value.kty === 'string' && value.kty !== '';
const getRandomIv = () => randomBytes(walletFileIvLength);
const createEncryptionKeyVersion = (timestamp = Date.now()) => Math.floor(timestamp / 1000);
const generateWalletEncryptionCryptoKeyPair = async () => await getCrypto().subtle.generateKey(walletKeyAlgorithm, true, [
    'deriveKey',
    'deriveBits'
]);
const exportWalletPublicKey = async (keyPair) => await getCrypto().subtle.exportKey('jwk', keyPair.publicKey);
const exportWalletPrivateKey = async (keyPair) => await getCrypto().subtle.exportKey('jwk', keyPair.privateKey);
const importWalletPublicKey = async (publicKey) => await getCrypto().subtle.importKey('jwk', publicKey, walletKeyAlgorithm, false, []);
const importWalletPrivateKey = async (privateKey) => await getCrypto().subtle.importKey('jwk', privateKey, walletKeyAlgorithm, true, [
    'deriveKey',
    'deriveBits'
]);
export const createWalletEncryptionKeyPair = async () => {
    const keyPair = await generateWalletEncryptionCryptoKeyPair();
    return {
        version: 1,
        algorithm: 'ECDH-P256',
        privateKey: await exportWalletPrivateKey(keyPair),
        publicKey: await exportWalletPublicKey(keyPair),
        keyVersion: createEncryptionKeyVersion()
    };
};
export const parseWalletEncryptionKeyPair = (value) => {
    if (!isPlainObject(value)) {
        throw new Error('Wallet encryption key backup must be an object.');
    }
    if (value.version !== 1 ||
        value.algorithm !== 'ECDH-P256' ||
        !isJsonWebKey(value.privateKey) ||
        !isJsonWebKey(value.publicKey) ||
        typeof value.keyVersion !== 'number') {
        throw new Error('Unsupported wallet encryption key backup.');
    }
    return {
        version: 1,
        algorithm: 'ECDH-P256',
        privateKey: value.privateKey,
        publicKey: value.publicKey,
        keyVersion: value.keyVersion
    };
};
export const createWalletEncryptionPublicKeySiweResource = ({ address, keyPair }) => `${encryptionPublicKeyResourcePrefix}${bytesToBase64Url(textEncoder.encode(JSON.stringify({
    kind: encryptionPublicKeyResourceKind,
    address: address.toLowerCase(),
    publicKey: keyPair.publicKey,
    keyVersion: keyPair.keyVersion
})))}`;
export const parseWalletEncryptionPublicKeySiweResource = ({ address, resources }) => {
    const resource = resources?.find(resource => resource.startsWith(encryptionPublicKeyResourcePrefix));
    if (resource == null)
        return null;
    try {
        const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(resource.substring(encryptionPublicKeyResourcePrefix.length))));
        if (payload.kind !== encryptionPublicKeyResourceKind ||
            payload.address?.toLowerCase() !== address.toLowerCase() ||
            !isJsonWebKey(payload.publicKey) ||
            typeof payload.keyVersion !== 'number') {
            return null;
        }
        return {
            kind: encryptionPublicKeyResourceKind,
            address: payload.address.toLowerCase(),
            publicKey: payload.publicKey,
            keyVersion: payload.keyVersion
        };
    }
    catch {
        return null;
    }
};
const deriveSelfEncryptionKey = async (keyPair) => {
    const privateKey = await importWalletPrivateKey(keyPair.privateKey);
    const publicKey = await importWalletPublicKey(keyPair.publicKey);
    return await getCrypto().subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
export const encryptFileWithWalletEncryptionKey = async ({ address, file, keyPair }) => {
    const key = await deriveSelfEncryptionKey(keyPair);
    const iv = getRandomIv();
    const ciphertext = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, await file.arrayBuffer());
    return {
        version: 1,
        kind: 'organigram:wallet-encrypted-file',
        algorithm: 'ECDH-P256+A256GCM',
        recipient: {
            address,
            publicKey: keyPair.publicKey,
            keyVersion: keyPair.keyVersion
        },
        file: {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
        },
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
        encryptedAt: new Date().toISOString()
    };
};
export const parseWalletEncryptedFilePackage = (value) => {
    if (!isPlainObject(value) || !isPlainObject(value.recipient)) {
        throw new Error('Encrypted file package must be an object.');
    }
    if (!isPlainObject(value.file)) {
        throw new Error('Encrypted file package is missing file metadata.');
    }
    if (value.version !== 1 ||
        value.kind !== 'organigram:wallet-encrypted-file' ||
        value.algorithm !== 'ECDH-P256+A256GCM' ||
        typeof value.recipient.address !== 'string' ||
        !/^0x[a-fA-F0-9]{40}$/.test(value.recipient.address) ||
        !isJsonWebKey(value.recipient.publicKey) ||
        typeof value.recipient.keyVersion !== 'number' ||
        typeof value.file.name !== 'string' ||
        typeof value.file.type !== 'string' ||
        typeof value.file.size !== 'number' ||
        typeof value.iv !== 'string' ||
        typeof value.ciphertext !== 'string' ||
        typeof value.encryptedAt !== 'string') {
        throw new Error('Unsupported encrypted file package.');
    }
    return {
        version: 1,
        kind: 'organigram:wallet-encrypted-file',
        algorithm: 'ECDH-P256+A256GCM',
        recipient: {
            address: value.recipient.address,
            publicKey: value.recipient.publicKey,
            keyVersion: value.recipient.keyVersion
        },
        file: {
            name: value.file.name,
            type: value.file.type,
            size: value.file.size,
            ...(typeof value.file.lastModified === 'number'
                ? { lastModified: value.file.lastModified }
                : {})
        },
        iv: value.iv,
        ciphertext: value.ciphertext,
        encryptedAt: value.encryptedAt
    };
};
export const decryptFileWithWalletEncryptionKey = async ({ encryptedPackage, keyPair }) => {
    if (encryptedPackage.recipient.keyVersion !== keyPair.keyVersion) {
        throw new Error('Encrypted file was created for another wallet encryption key.');
    }
    const key = await deriveSelfEncryptionKey(keyPair);
    const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(base64UrlToBytes(encryptedPackage.iv)) }, key, toArrayBuffer(base64UrlToBytes(encryptedPackage.ciphertext)));
    const bytes = new Uint8Array(plaintext);
    if (bytes.byteLength !== encryptedPackage.file.size) {
        throw new Error('Decrypted file size does not match package metadata.');
    }
    return {
        name: encryptedPackage.file.name,
        type: encryptedPackage.file.type,
        bytes,
        ...(encryptedPackage.file.lastModified == null
            ? {}
            : { lastModified: encryptedPackage.file.lastModified })
    };
};
