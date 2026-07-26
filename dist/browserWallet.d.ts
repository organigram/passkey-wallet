import { type WalletEncryptionKeyPairPayload } from './encryption';
import type { StoredVaultAccount, StoredVaultRecord } from './localVault';
import type { UnlockedPasskeyWallet } from './types';
export type BrowserPasskeyWalletVaultPayload = {
    version: 1;
    recoveryPhrase: string;
    walletEncryptionKey?: WalletEncryptionKeyPairPayload;
};
export declare const createBrowserPasskeyWalletVaultPayload: (recoveryPhrase: string) => Promise<BrowserPasskeyWalletVaultPayload>;
export declare const parseBrowserPasskeyWalletVaultPayload: (plaintext: string) => BrowserPasskeyWalletVaultPayload;
export declare const inferPasskeyRpId: (hostname?: string) => string;
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
export declare const unlockBrowserPasskeyVault: ({ records, rpId }: {
    records: StoredVaultRecord[];
    rpId?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
    prfOutput: Uint8Array;
}>;
export declare const updateStaticPasskeyVaultEncryptionKey: ({ records, walletEncryptionKey, rpId }: {
    records: StoredVaultRecord[];
    walletEncryptionKey: WalletEncryptionKeyPairPayload;
    rpId?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
export declare const getDiscoverablePasskeyPrfOutput: ({ rpId }?: {
    rpId?: string;
}) => Promise<Uint8Array>;
export declare const signPersonalMessage: ({ wallet, message }: {
    wallet: UnlockedPasskeyWallet;
    message: string;
}) => Promise<`0x${string}`>;
export declare const hexEncodeMessage: (message: string) => `0x${string}`;
