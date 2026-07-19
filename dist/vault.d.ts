export type PasskeyWalletVaultPayload = {
    version: 1;
    recoveryPhrase: string;
    userEncryptionPrivateKey: JsonWebKey;
    userEncryptionPublicKey: JsonWebKey;
    userEncryptionKeyVersion: number;
};
export declare const serializePasskeyWalletVaultPayload: ({ recoveryPhrase, userEncryptionPrivateKey, userEncryptionPublicKey, userEncryptionKeyVersion }: Omit<PasskeyWalletVaultPayload, "version">) => string;
export declare const parsePasskeyWalletVaultPayload: (plaintext: string) => PasskeyWalletVaultPayload;
export declare const createPasskeyWalletVaultPayload: (recoveryPhrase: string) => Promise<PasskeyWalletVaultPayload>;
