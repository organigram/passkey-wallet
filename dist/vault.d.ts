import { type WalletEncryptionKeyPairPayload } from './encryption';
export type PasskeyWalletVaultPayload = {
    version: 1;
    recoveryPhrase: string;
    walletEncryptionKey?: WalletEncryptionKeyPairPayload;
};
export declare const serializePasskeyWalletVaultPayload: ({ recoveryPhrase, walletEncryptionKey }: Omit<PasskeyWalletVaultPayload, "version">) => string;
export declare const parsePasskeyWalletVaultPayload: (plaintext: string) => PasskeyWalletVaultPayload;
export declare const createPasskeyWalletVaultPayload: (recoveryPhrase: string) => Promise<PasskeyWalletVaultPayload>;
