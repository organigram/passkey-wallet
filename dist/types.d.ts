import type { HDAccount } from 'viem/accounts';
export declare const organigramPasskeyWalletId = "organigram-passkeys";
export declare const organigramPasskeyWalletIcon = "/png/logo-gradient.png";
export type OrganigramPasskeyCapabilities = {
    method?: 'login' | 'register';
    name?: string;
    identity?: {
        email: string;
    };
};
export type PasskeyWalletLoginCapabilities = {
    method: 'login';
};
export type PasskeyWalletRegistrationCapabilities = {
    method: 'register';
    name: string;
    identity?: {
        email: string;
    };
};
export type PasskeyWalletCapabilities = PasskeyWalletLoginCapabilities | PasskeyWalletRegistrationCapabilities;
export type IdentityPasskeyCapabilities = PasskeyWalletRegistrationCapabilities & {
    identity: {
        email: string;
    };
};
export declare const buildIdentityPasskeyCapabilities: (email: string) => IdentityPasskeyCapabilities;
export declare const buildPasskeyWalletCapabilities: () => PasskeyWalletCapabilities;
export declare const buildEmailPasskeyCapabilities: (email: string) => IdentityPasskeyCapabilities;
export type UnlockedPasskeyWallet = {
    address: `0x${string}`;
    account: HDAccount;
    recoveryPhrase: string;
    userEncryptionPrivateKey: JsonWebKey;
    userEncryptionPublicKey: JsonWebKey;
    userEncryptionKeyVersion: number;
    credentialId: string;
    expiresAt: number;
};
export type PasskeyRegistrationResult = {
    address: `0x${string}`;
    credentialId: string;
};
export type PasskeyProviderEvent = 'accountsChanged' | 'chainChanged' | 'disconnect';
export type PasskeyProviderListener = (...args: unknown[]) => void;
