import type { PasskeyWalletTypedData } from './remoteProtocol';
import { type WalletEncryptionKeyPairPayload } from './encryption';
import { type PasskeyVaultEnvelopeData } from './crypto';
import type { StoredVaultAccount, StoredVaultRecord } from './localVault';
import type { UnlockedPasskeyWallet } from './types';
/**
 * The secrets encrypted in a passkey vault.
 *
 * @remarks
 * Holds the recovery phrase in clear: never store, send or log it outside an
 * encrypted envelope.
 */
export type BrowserPasskeyWalletVaultPayload = {
    /** Version of the payload format. */
    version: 1;
    /** BIP-39 recovery phrase of the wallet. */
    recoveryPhrase: string;
    /** Key pair of the wallet for end-to-end encryption. */
    walletEncryptionKey?: WalletEncryptionKeyPairPayload;
};
/**
 * Create the payload of a new vault, with a new wallet encryption key pair.
 *
 * @param recoveryPhrase - The recovery phrase of the wallet.
 */
export declare const createBrowserPasskeyWalletVaultPayload: (recoveryPhrase: string) => Promise<BrowserPasskeyWalletVaultPayload>;
/**
 * Read a decrypted vault payload.
 *
 * @param plaintext - The decrypted payload, in JSON.
 * @throws When the payload is invalid or of an unsupported version.
 */
export declare const parseBrowserPasskeyWalletVaultPayload: (plaintext: string) => BrowserPasskeyWalletVaultPayload;
/** Generate a new 12-word English BIP-39 recovery phrase. */
export declare const createGeneratedRecoveryPhrase: () => string;
/**
 * Get the Ethereum BIP-44 derivation path of an address index.
 *
 * @param addressIndex - The address index.
 */
export declare const getDerivationPath: (addressIndex: number) => string;
/**
 * Derive the account of an address index from a recovery phrase.
 *
 * @param input - The recovery phrase, the address index, and the name of the
 * account, `Account <index + 1>` by default.
 */
export declare const deriveStoredVaultAccount: ({ recoveryPhrase, addressIndex, name }: {
    recoveryPhrase: string;
    addressIndex: number;
    name: string;
}) => StoredVaultAccount;
/**
 * Switch an unlocked wallet to another of its accounts.
 *
 * @param input - The unlocked wallet and the account to select.
 * @throws When the account does not derive from the recovery phrase of the
 * wallet.
 */
export declare const derivePasskeyWalletAccount: ({ wallet, account }: {
    wallet: UnlockedPasskeyWallet;
    account: StoredVaultAccount;
}) => UnlockedPasskeyWallet;
/**
 * Create a passkey and a vault encrypting a recovery phrase with it.
 *
 * @remarks
 * Asks the browser to create a discoverable passkey with user verification and
 * the PRF extension. The recovery phrase is encrypted with a key derived from
 * the PRF output, which is then zeroed. Store the returned record, which holds
 * no secret in clear, and keep the unlocked wallet in memory only.
 * @param input - The recovery phrase, the name of the wallet, the WebAuthn
 * relying party identifier, the current host name by default, and the relying
 * party name.
 * @returns The vault record and the unlocked wallet, on its first account.
 * @throws When passkeys are not available, or the passkey returns no valid PRF
 * output.
 * @example
 * ```ts
 * const { record, wallet } = await registerBrowserPasskeyVault({
 *   recoveryPhrase: createGeneratedRecoveryPhrase(),
 *   name: 'My wallet'
 * })
 * ```
 */
export declare const registerBrowserPasskeyVault: ({ recoveryPhrase, name, rpId, rpName }: {
    recoveryPhrase: string;
    name: string;
    rpId?: string;
    rpName?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
/**
 * Create another passkey able to unlock an unlocked wallet, for example as a
 * backup.
 *
 * @param input - The unlocked wallet, the name of the passkey, the accounts it
 * unlocks, and the WebAuthn relying party.
 * @returns The new vault record and the wallet, now attached to the new
 * passkey.
 * @throws When passkeys are not available, or the passkey returns no valid PRF
 * output.
 */
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
/** A passkey to evaluate with its PRF salt. */
export type PasskeyPrfCredential = {
    /** Raw identifier of the passkey, in base64url. */
    credentialId: string;
    /** WebAuthn transports of the passkey. */
    transports?: string[];
    /** PRF salt of the vault, in base64url. */
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
/**
 * Decrypt a vault envelope with the PRF output of its passkey.
 *
 * @remarks
 * Does not zero the PRF output, so that the caller may try several envelopes
 * with it. Zero it once done.
 * @param input - The envelope and the PRF output.
 * @throws When decryption fails or the payload is invalid.
 */
export declare const decryptVaultPayloadWithPrfOutput: ({ envelope, prfOutput }: {
    envelope: PasskeyVaultEnvelopeData;
    prfOutput: Uint8Array;
}) => Promise<BrowserPasskeyWalletVaultPayload>;
/**
 * Unlock a wallet with one of the passkeys of its vaults.
 *
 * @remarks
 * Asks the user to pick one of the passkeys of the records, with user
 * verification. The vaults of that passkey are tried in turn, and the first
 * whose recovery phrase derives the address of its record is unlocked. The PRF
 * output is zeroed.
 * @param input - The vault records to choose from, and the WebAuthn relying
 * party identifier, the current host name by default.
 * @returns The record unlocked and the wallet, on the first account of the
 * record.
 * @throws When no record is given or no vault of the selected passkey can be
 * decrypted.
 * @example
 * ```ts
 * const { wallet } = await unlockBrowserPasskeyVault({ records })
 * const signature = await signPersonalMessage({ wallet, message: 'Hello' })
 * ```
 */
export declare const unlockBrowserPasskeyVault: ({ records, rpId }: {
    records: StoredVaultRecord[];
    rpId?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
/**
 * Unlock a vault and re-encrypt it with another wallet encryption key pair.
 *
 * @remarks
 * Asks the user for a passkey, and keeps the PRF salt of the vault. Store the
 * returned record in place of the old one.
 * @param input - The vault records to choose from, the new key pair and the
 * WebAuthn relying party identifier.
 * @returns The re-encrypted record and the unlocked wallet.
 */
export declare const updateStaticPasskeyVaultEncryptionKey: ({ records, walletEncryptionKey, rpId }: {
    records: StoredVaultRecord[];
    walletEncryptionKey: WalletEncryptionKeyPairPayload;
    rpId?: string;
}) => Promise<{
    record: StoredVaultRecord;
    wallet: UnlockedPasskeyWallet;
}>;
/**
 * Sign a message with EIP-191 `personal_sign`.
 *
 * @param input - The unlocked wallet and the message.
 */
export declare const signPersonalMessage: ({ wallet, message }: {
    wallet: UnlockedPasskeyWallet;
    message: string;
}) => Promise<`0x${string}`>;
/**
 * Sign EIP-712 typed data.
 *
 * @param input - The unlocked wallet and the typed data.
 */
export declare const signTypedDataMessage: ({ wallet, typedData }: {
    wallet: UnlockedPasskeyWallet;
    typedData: PasskeyWalletTypedData;
}) => Promise<`0x${string}`>;
/**
 * Encode a UTF-8 message in hex, as `personal_sign` requests carry it.
 *
 * @param message - The message.
 */
export declare const hexEncodeMessage: (message: string) => `0x${string}`;
