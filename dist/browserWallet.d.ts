import type { PasskeyWalletTypedData } from './remoteProtocol';
import { type WalletEncryptionKeyPairPayload } from './encryption';
import { type PasskeyVaultEnvelopeData } from './crypto';
import type { StoredVaultAccount, StoredVaultRecord } from './localVault';
import type { UnlockedPasskeyWallet } from './types';
export type BrowserPasskeyWalletVaultPayload = {
    version: 1;
    recoveryPhrase: string;
    walletEncryptionKey?: WalletEncryptionKeyPairPayload;
};
export declare const createBrowserPasskeyWalletVaultPayload: (recoveryPhrase: string) => Promise<BrowserPasskeyWalletVaultPayload>;
export declare const parseBrowserPasskeyWalletVaultPayload: (plaintext: string) => BrowserPasskeyWalletVaultPayload;
export declare const createGeneratedRecoveryPhrase: () => string;
export declare const getDerivationPath: (addressIndex: number) => string;
export declare const deriveStoredVaultAccount: ({ recoveryPhrase, addressIndex, name }: {
    recoveryPhrase: string;
    addressIndex: number;
    name: string;
}) => StoredVaultAccount;
export declare const derivePasskeyWalletAccount: ({ wallet, account }: {
    wallet: UnlockedPasskeyWallet;
    account: StoredVaultAccount;
}) => UnlockedPasskeyWallet;
export declare const registerBrowserPasskeyVault: ({ recoveryPhrase, name, rpId, rpName }: {
    recoveryPhrase: string;
    name: string;
    rpId?: string;
    rpName?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
export declare const registerAdditionalBrowserPasskeyVault: ({ wallet, name, accounts, rpId, rpName }: {
    wallet: UnlockedPasskeyWallet;
    name: string;
    accounts: StoredVaultAccount[];
    rpId?: string;
    rpName?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
export type PasskeyPrfCredential = {
    credentialId: string;
    transports?: string[];
    prfSalt: string;
};
/**
 * Runs one user-verified assertion restricted to the given passkeys, each
 * evaluated with its own PRF salt, and returns the PRF output of the passkey
 * the person selected. The caller owns the returned PRF output and must zero
 * it once its key is derived.
 */
export declare const requestPasskeyPrfOutput: ({ credentials, rpId }: {
    credentials: PasskeyPrfCredential[];
    rpId?: string;
}) => Promise<{
    credentialId: string;
    prfOutput: Uint8Array;
}>;
export declare const decryptVaultPayloadWithPrfOutput: ({ envelope, prfOutput }: {
    envelope: PasskeyVaultEnvelopeData;
    prfOutput: Uint8Array;
}) => Promise<BrowserPasskeyWalletVaultPayload>;
export declare const unlockBrowserPasskeyVault: ({ records, rpId }: {
    records: StoredVaultRecord[];
    rpId?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
export declare const updateStaticPasskeyVaultEncryptionKey: ({ records, walletEncryptionKey, rpId }: {
    records: StoredVaultRecord[];
    walletEncryptionKey: WalletEncryptionKeyPairPayload;
    rpId?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
export declare const signPersonalMessage: ({ wallet, message }: {
    wallet: UnlockedPasskeyWallet;
    message: string;
}) => Promise<`0x${string}`>;
export declare const signTypedDataMessage: ({ wallet, typedData }: {
    wallet: UnlockedPasskeyWallet;
    typedData: PasskeyWalletTypedData;
}) => Promise<`0x${string}`>;
export declare const hexEncodeMessage: (message: string) => `0x${string}`;
