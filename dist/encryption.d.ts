export type WalletEncryptionKeyPairPayload = {
    version: 1;
    algorithm: 'ECDH-P256';
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
    keyVersion: number;
};
export type WalletEncryptedFilePackage = {
    version: 1;
    kind: 'organigram:wallet-encrypted-file';
    algorithm: 'ECDH-P256+A256GCM';
    recipient: {
        address: `0x${string}`;
        publicKey: JsonWebKey;
        keyVersion: number;
    };
    file: {
        name: string;
        type: string;
        size: number;
        lastModified?: number;
    };
    iv: string;
    ciphertext: string;
    encryptedAt: string;
};
export type WalletEncryptedPayload = {
    version: 1;
    kind: 'organigram:wallet-encrypted-payload';
    algorithm: 'ECDH-P256+A256GCM';
    /** Only this application origin may have the payload decrypted. */
    appOrigin: string;
    recipient: {
        address: `0x${string}`;
        publicKey: JsonWebKey;
        keyVersion: number;
    };
    iv: string;
    ciphertext: string;
    encryptedAt: string;
};
export type WalletDecryptedFile = {
    name: string;
    type: string;
    bytes: Uint8Array;
    lastModified?: number;
};
declare const encryptionPublicKeyResourceKind: "organigram.encryption-public-key.v1";
export declare const createWalletEncryptionKeyPair: () => Promise<WalletEncryptionKeyPairPayload>;
export declare const parseWalletEncryptionKeyPair: (value: unknown) => WalletEncryptionKeyPairPayload;
export declare const createWalletEncryptionPublicKeySiweResource: ({ address, keyPair }: {
    address: `0x${string}`;
    keyPair: WalletEncryptionKeyPairPayload;
}) => string;
export type WalletEncryptionPublicKeySiweResource = {
    kind: typeof encryptionPublicKeyResourceKind;
    address: string;
    publicKey: JsonWebKey;
    keyVersion: number;
};
export declare const parseWalletEncryptionPublicKeySiweResource: ({ address, resources }: {
    address: string;
    resources: string[] | undefined;
}) => WalletEncryptionPublicKeySiweResource | null;
export declare const encryptFileWithWalletEncryptionKey: ({ address, file, keyPair }: {
    address: `0x${string}`;
    file: File;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<WalletEncryptedFilePackage>;
export declare const encryptPayloadWithWalletEncryptionKey: ({ address, appOrigin, plaintext, keyPair }: {
    address: `0x${string}`;
    appOrigin: string;
    plaintext: string;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<WalletEncryptedPayload>;
export declare const parseWalletEncryptedFilePackage: (value: unknown) => WalletEncryptedFilePackage;
export declare const parseWalletEncryptedPayload: (value: unknown) => WalletEncryptedPayload;
export declare const decryptFileWithWalletEncryptionKey: ({ encryptedPackage, keyPair }: {
    encryptedPackage: WalletEncryptedFilePackage;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<WalletDecryptedFile>;
export declare const decryptPayloadWithWalletEncryptionKey: ({ encryptedPayload, appOrigin, keyPair }: {
    encryptedPayload: WalletEncryptedPayload;
    appOrigin: string;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<string>;
export {};
