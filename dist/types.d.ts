import type { HDAccount } from 'viem/accounts';
import type { WalletEncryptionKeyPairPayload } from './encryption';
/** Identifier of the passkey wallet connector. */
export declare const organigramPasskeyWalletId = "organigram-passkeys";
/** Path of the icon of the passkey wallet, relative to the app serving it. */
export declare const organigramPasskeyWalletIcon = "/png/logo-gradient.png";
/**
 * A wallet unlocked with a passkey, ready to sign.
 *
 * @remarks
 * It holds the recovery phrase and the private keys in memory. Keep it in
 * memory only for as long as needed, never store, send or log it.
 */
export type UnlockedPasskeyWallet = {
    /** Address of the selected account. */
    address: `0x${string}`;
    /**
     * viem account of the selected address, which signs messages and
     * transactions.
     */
    account: HDAccount;
    /**
     * BIP-39 recovery phrase of the wallet, from which all its accounts derive.
     */
    recoveryPhrase: string;
    /**
     * Key pair of the wallet for end-to-end encryption, if the vault holds one.
     */
    walletEncryptionKey?: WalletEncryptionKeyPairPayload;
    /** Identifier of the passkey that unlocked the wallet. */
    credentialId: string;
};
/** The address and passkey of a newly registered wallet. */
export type PasskeyRegistrationResult = {
    /** Address of the first account of the wallet. */
    address: `0x${string}`;
    /** Identifier of the new passkey. */
    credentialId: string;
};
/** Events emitted by the EIP-1193 provider of the wallet. */
export type PasskeyProviderEvent = 'accountsChanged' | 'chainChanged' | 'disconnect';
/** Listener of a provider event. */
export type PasskeyProviderListener = (...args: unknown[]) => void;
