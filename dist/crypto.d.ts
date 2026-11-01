export declare const passkeyVaultAlgorithm = "AES-GCM-HKDF-SHA-256";
export declare const passkeyVaultKeyVersion = 2;
export type PasskeyVaultEnvelopeData = {
    algorithm: typeof passkeyVaultAlgorithm;
    keyVersion: typeof passkeyVaultKeyVersion;
    ciphertext: string;
    salt: string;
    prfSalt: string;
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
export declare const textEncoder: TextEncoder;
export declare const textDecoder: TextDecoder;
export declare const getCrypto: () => Crypto;
export declare const toArrayBuffer: (bytes: Uint8Array) => ArrayBuffer;
export declare const randomBytes: (length: number) => Uint8Array;
export declare const bytesToBase64Url: (bytes: Uint8Array) => string;
export declare const base64UrlToBytes: (value: string) => Uint8Array;
export declare const hasBase64UrlByteLength: (value: unknown, isValidLength: (byteLength: number) => boolean) => boolean;
export declare const isPasskeyVaultEnvelope: (value: unknown) => value is PasskeyVaultEnvelopeData;
export declare const derivePasskeyVaultKey: ({ prfOutput, salt, info }: DerivePasskeyVaultKeyInput) => Promise<CryptoKey>;
export declare const encryptPasskeyVaultSecret: ({ plaintext, key, salt, prfSalt, nonce }: EncryptPasskeyVaultSecretInput) => Promise<PasskeyVaultEnvelopeData>;
export declare const decryptPasskeyVaultSecret: ({ envelope, key }: DecryptPasskeyVaultSecretInput) => Promise<string>;
export declare const isPasskeyPrfSupported: ({ credential }: {
    credential: PrfSupportCredential | null;
}) => Promise<boolean>;
export {};
