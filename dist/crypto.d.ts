export declare const passkeyVaultAlgorithm = "AES-GCM-HKDF-SHA-256";
export declare const passkeyVaultKeyVersion = 1;
export type PasskeyVaultEnvelopeData = {
    algorithm: typeof passkeyVaultAlgorithm;
    keyVersion: typeof passkeyVaultKeyVersion;
    ciphertext: string;
    salt: string;
    nonce: string;
};
type DerivePasskeyVaultKeyInput = {
    prfOutput: Uint8Array;
    salt: Uint8Array;
};
type EncryptPasskeyVaultSecretInput = {
    plaintext: string;
    key: CryptoKey;
    salt: Uint8Array;
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
export declare const derivePasskeyVaultKey: ({ prfOutput, salt }: DerivePasskeyVaultKeyInput) => Promise<CryptoKey>;
export declare const encryptPasskeyVaultSecret: ({ plaintext, key, salt, nonce }: EncryptPasskeyVaultSecretInput) => Promise<PasskeyVaultEnvelopeData>;
export declare const decryptPasskeyVaultSecret: ({ envelope, key }: DecryptPasskeyVaultSecretInput) => Promise<string>;
export declare const isPasskeyPrfSupported: ({ credential }: {
    credential: PrfSupportCredential | null;
}) => Promise<boolean>;
export {};
