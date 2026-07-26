import type { HDAccount } from 'viem/accounts';
import type { WalletEncryptionKeyPairPayload } from './encryption';
export declare const organigramPasskeyWalletId = "organigram-passkeys";
export declare const organigramPasskeyWalletIcon = "/png/logo-gradient.png";
export type UnlockedPasskeyWallet = {
    address: `0x${string}`;
    account: HDAccount;
    recoveryPhrase: string;
    walletEncryptionKey?: WalletEncryptionKeyPairPayload;
    credentialId: string;
    expiresAt: number;
};
export type PasskeyRegistrationResult = {
    address: `0x${string}`;
    credentialId: string;
};
export type PasskeyProviderEvent = 'accountsChanged' | 'chainChanged' | 'disconnect';
export type PasskeyProviderListener = (...args: unknown[]) => void;
