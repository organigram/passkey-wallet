/**
 * The ECDH P-256 key pair of a wallet for end-to-end encryption, stored in its
 * passkey vaults.
 *
 * @remarks
 * Holds the private key in clear: keep it in the encrypted vault and in memory
 * only, never store, send or log it elsewhere.
 */
export type WalletEncryptionKeyPairPayload = {
    /** Version of the format. */
    version: 1;
    /** Always `ECDH-P256`. */
    algorithm: 'ECDH-P256';
    /** Private key, as a JSON Web Key. */
    privateKey: JsonWebKey;
    /** Public key, as a JSON Web Key. */
    publicKey: JsonWebKey;
    /**
     * Version of the key pair: the time it was created, in seconds since the Unix
     * epoch.
     */
    keyVersion: number;
};
/** A file encrypted for the wallet that encrypted it. */
export type WalletEncryptedFilePackage = {
    /** Version of the format. */
    version: 1;
    /** Always `organigram:wallet-encrypted-file`. */
    kind: 'organigram:wallet-encrypted-file';
    /** Always `ECDH-P256+A256GCM`. */
    algorithm: 'ECDH-P256+A256GCM';
    /** Wallet and key pair able to decrypt the file. */
    recipient: {
        address: `0x${string}`;
        publicKey: JsonWebKey;
        keyVersion: number;
    };
    /** Name, MIME type, size and modification date of the file, in clear. */
    file: {
        name: string;
        type: string;
        size: number;
        lastModified?: number;
    };
    /** 12-byte AES-GCM nonce, in base64url. */
    iv: string;
    /** Encrypted file, in base64url. */
    ciphertext: string;
    /** ISO 8601 date of the encryption. */
    encryptedAt: string;
};
/**
 * A text encrypted by a wallet for itself, which only one application origin
 * may have decrypted.
 */
export type WalletEncryptedPayload = {
    /** Version of the format. */
    version: 1;
    /** Always `organigram:wallet-encrypted-payload`. */
    kind: 'organigram:wallet-encrypted-payload';
    /** Always `ECDH-P256+A256GCM`. */
    algorithm: 'ECDH-P256+A256GCM';
    /** Only this application origin may have the payload decrypted. */
    appOrigin: string;
    /** Wallet and key pair able to decrypt the payload. */
    recipient: {
        address: `0x${string}`;
        publicKey: JsonWebKey;
        keyVersion: number;
    };
    /** 12-byte AES-GCM nonce, in base64url. */
    iv: string;
    /** Encrypted text, in base64url. */
    ciphertext: string;
    /** ISO 8601 date of the encryption. */
    encryptedAt: string;
};
/** A decrypted file. */
export type WalletDecryptedFile = {
    /** Name of the file. */
    name: string;
    /** MIME type of the file. */
    type: string;
    /** Contents of the file. */
    bytes: Uint8Array;
    /** Modification date of the file, in milliseconds since the Unix epoch. */
    lastModified?: number;
};
declare const encryptionPublicKeyResourceKind: "organigram.encryption-public-key.v1";
/**
 * Generate a new ECDH P-256 key pair for a wallet.
 *
 * @remarks
 * The private key is exportable, so that it can be stored in the passkey vaults
 * of the wallet. Keep it there.
 */
export declare const createWalletEncryptionKeyPair: () => Promise<WalletEncryptionKeyPairPayload>;
/**
 * Read a wallet encryption key pair.
 *
 * @param value - The key pair, parsed from JSON.
 * @throws When the value is not a key pair of a supported version.
 */
export declare const parseWalletEncryptionKeyPair: (value: unknown) => WalletEncryptionKeyPairPayload;
/**
 * Encode the public key of a wallet as a resource of a Sign-In with Ethereum
 * message.
 *
 * @remarks
 * Signing in with this resource lets the application learn the public key of
 * the wallet, bound to its address by the signature.
 * @param input - The address of the wallet and its key pair. Only the public
 * key is encoded.
 */
export declare const createWalletEncryptionPublicKeySiweResource: ({ address, keyPair }: {
    address: `0x${string}`;
    keyPair: WalletEncryptionKeyPairPayload;
}) => string;
/** The public key of a wallet, read from a Sign-In with Ethereum resource. */
export type WalletEncryptionPublicKeySiweResource = {
    /** Always `organigram.encryption-public-key.v1`. */
    kind: typeof encryptionPublicKeyResourceKind;
    /** Address of the wallet, in lowercase. */
    address: string;
    /** Public key of the wallet, as a JSON Web Key. */
    publicKey: JsonWebKey;
    /** Version of the key pair. */
    keyVersion: number;
};
/**
 * Read the public key of a wallet from the resources of a Sign-In with Ethereum
 * message.
 *
 * @remarks
 * Only trust the result once the signature of the message is verified.
 * @param input - The address that signed the message, and the resources of the
 * message.
 * @returns The public key, or `null` if no valid resource of this address is
 * found.
 */
export declare const parseWalletEncryptionPublicKeySiweResource: ({ address, resources }: {
    address: string;
    resources: string[] | undefined;
}) => WalletEncryptionPublicKeySiweResource | null;
/**
 * Encrypt a file so that only the wallet holding the key pair can decrypt it.
 *
 * @remarks
 * The AES-GCM key is derived by ECDH between the private and public keys of the
 * same key pair. The name, type, size and date of the file stay in clear and
 * are not authenticated with the ciphertext.
 * @param input - The address of the wallet, the file and the key pair.
 */
export declare const encryptFileWithWalletEncryptionKey: ({ address, file, keyPair }: {
    address: `0x${string}`;
    file: File;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<WalletEncryptedFilePackage>;
/**
 * Encrypt a text so that only the wallet holding the key pair can decrypt it,
 * for one application origin.
 *
 * @remarks
 * The application origin, the address and the key version are authenticated
 * with the ciphertext, so that the payload cannot be decrypted for another
 * application or relabelled for it.
 * @param input - The address of the wallet, the origin of the application, the
 * text and the key pair.
 * @throws When the application origin is not a valid URL.
 */
export declare const encryptPayloadWithWalletEncryptionKey: ({ address, appOrigin, plaintext, keyPair }: {
    address: `0x${string}`;
    appOrigin: string;
    plaintext: string;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<WalletEncryptedPayload>;
/**
 * Read an encrypted file package.
 *
 * @param value - The package, parsed from JSON.
 * @throws When the value is not a package of a supported version.
 */
export declare const parseWalletEncryptedFilePackage: (value: unknown) => WalletEncryptedFilePackage;
/**
 * Read an encrypted payload.
 *
 * @param value - The payload, parsed from JSON.
 * @throws When the value is not a payload of a supported version.
 */
export declare const parseWalletEncryptedPayload: (value: unknown) => WalletEncryptedPayload;
/**
 * Decrypt a file encrypted with `encryptFileWithWalletEncryptionKey()`.
 *
 * @param input - The encrypted package and the key pair of the wallet.
 * @throws When the package was encrypted with another key pair, decryption
 * fails, or the decrypted size does not match the package.
 */
export declare const decryptFileWithWalletEncryptionKey: ({ encryptedPackage, keyPair }: {
    encryptedPackage: WalletEncryptedFilePackage;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<WalletDecryptedFile>;
/**
 * Decrypt a text encrypted with `encryptPayloadWithWalletEncryptionKey()`.
 *
 * @param input - The encrypted payload, the origin of the application asking
 * for it, and the key pair of the wallet.
 * @throws When the payload was encrypted with another key pair or for another
 * application origin, or decryption fails.
 */
export declare const decryptPayloadWithWalletEncryptionKey: ({ encryptedPayload, appOrigin, keyPair }: {
    encryptedPayload: WalletEncryptedPayload;
    appOrigin: string;
    keyPair: WalletEncryptionKeyPairPayload;
}) => Promise<string>;
export {};
