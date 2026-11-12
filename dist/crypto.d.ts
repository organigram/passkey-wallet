/**
 * Algorithm of passkey vaults: AES-256-GCM with a key derived by HKDF-SHA-256
 * from the passkey PRF output.
 */
export declare const passkeyVaultAlgorithm = "AES-GCM-HKDF-SHA-256";
/** Version of the key derivation of passkey vaults. */
export declare const passkeyVaultKeyVersion = 2;
/**
 * A secret encrypted with a key derived from a passkey, such as the recovery
 * phrase of a wallet.
 *
 * @remarks
 * The envelope holds no secret: it can be stored anywhere, as only the passkey
 * that created it can decrypt it.
 */
export type PasskeyVaultEnvelopeData = {
    /** Always `passkeyVaultAlgorithm`. */
    algorithm: typeof passkeyVaultAlgorithm;
    /** Always `passkeyVaultKeyVersion`. */
    keyVersion: typeof passkeyVaultKeyVersion;
    /** Encrypted secret with its authentication tag, in base64url. */
    ciphertext: string;
    /** Random 32-byte HKDF salt, in base64url. */
    salt: string;
    /**
     * Random 32-byte input of the passkey PRF, in base64url.
     *
     * @remarks
     * The passkey evaluates it for this vault only, so that no two vaults, nor
     * any other application on the same RP ID, share a PRF output. It is not
     * secret: without the passkey it yields nothing.
     */
    prfSalt: string;
    /** 12-byte AES-GCM nonce, in base64url. */
    nonce: string;
};
type DerivePasskeyVaultKeyInput = {
    prfOutput: Uint8Array;
    salt: Uint8Array;
    info?: string;
};
type EncryptPasskeyVaultSecretInput = {
    plaintext: string;
    key: CryptoKey;
    salt: Uint8Array;
    prfSalt: Uint8Array;
    nonce?: Uint8Array;
};
type DecryptPasskeyVaultSecretInput = {
    envelope: PasskeyVaultEnvelopeData;
    key: CryptoKey;
};
type PrfSupportCredential = {
    getClientExtensionResults: () => {
        prf?: {
            enabled?: boolean;
        };
    };
};
/** Shared UTF-8 encoder. */
export declare const textEncoder: TextEncoder;
/** Shared UTF-8 decoder. */
export declare const textDecoder: TextDecoder;
/**
 * Get the Web Crypto API of the environment.
 *
 * @throws When Web Crypto is not available.
 */
export declare const getCrypto: () => Crypto;
/**
 * Copy the bytes of a view into a new `ArrayBuffer`.
 *
 * @param bytes - The bytes to copy.
 */
export declare const toArrayBuffer: (bytes: Uint8Array) => ArrayBuffer;
/**
 * Generate cryptographically secure random bytes.
 *
 * @param length - Number of bytes.
 */
export declare const randomBytes: (length: number) => Uint8Array;
/**
 * Encode bytes in unpadded base64url.
 *
 * @param bytes - The bytes to encode.
 */
export declare const bytesToBase64Url: (bytes: Uint8Array) => string;
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
export declare const base64UrlToBytes: (value: string) => Uint8Array;
/**
 * Check that a value is canonical base64url whose decoded length passes a test.
 *
 * @param value - The value to check.
 * @param isValidLength - Test of the decoded length, in bytes.
 */
export declare const hasBase64UrlByteLength: (value: unknown, isValidLength: (byteLength: number) => boolean) => boolean;
/**
 * Check that a value is a passkey vault envelope of the current algorithm and
 * key version, with salts, nonce and ciphertext of valid lengths.
 *
 * @param value - The value to check.
 */
export declare const isPasskeyVaultEnvelope: (value: unknown) => value is PasskeyVaultEnvelopeData;
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
export declare const derivePasskeyVaultKey: ({ prfOutput, salt, info }: DerivePasskeyVaultKeyInput) => Promise<CryptoKey>;
/**
 * Encrypt a secret with a vault key into a vault envelope.
 *
 * @param input - The secret, the key from `derivePasskeyVaultKey()`, the salt
 * it was derived with, the 32-byte PRF salt, and an optional 12-byte nonce,
 * random by default. Never reuse a nonce with the same key.
 * @throws When the secret is empty or the PRF salt is not 32 bytes.
 */
export declare const encryptPasskeyVaultSecret: ({ plaintext, key, salt, prfSalt, nonce }: EncryptPasskeyVaultSecretInput) => Promise<PasskeyVaultEnvelopeData>;
/**
 * Decrypt the secret of a vault envelope.
 *
 * @param input - The envelope and the key derived for it.
 * @throws When the algorithm or key version is not supported, or the key or
 * envelope is wrong.
 */
export declare const decryptPasskeyVaultSecret: ({ envelope, key }: DecryptPasskeyVaultSecretInput) => Promise<string>;
/**
 * Check whether a newly created passkey enabled the PRF extension, which the
 * wallet needs to derive its keys.
 *
 * @param input - The credential returned by `navigator.credentials.create()`.
 */
export declare const isPasskeyPrfSupported: ({ credential }: {
    credential: PrfSupportCredential | null;
}) => Promise<boolean>;
export {};
