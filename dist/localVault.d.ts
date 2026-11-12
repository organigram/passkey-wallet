import { type PasskeyVaultEnvelopeData } from './crypto';
/** An account of a wallet, derived from its recovery phrase. */
export type StoredVaultAccount = {
    /** Address of the account. */
    address: `0x${string}`;
    /** Name of the account. */
    name: string;
    /** BIP-44 address index of the account. */
    addressIndex: number;
    /**
     * BIP-44 derivation path of the account, as returned by
     * `getDerivationPath()`.
     */
    derivationPath: string;
};
/**
 * A wallet vault encrypted for one passkey, with the public details needed to
 * unlock it.
 *
 * @remarks
 * A wallet has one record per passkey that can unlock it. The record holds no
 * secret in clear: only its passkey can decrypt the envelope.
 */
export type StoredVaultRecord = {
    /** Version of the record format. */
    version: 1;
    /** Address of the first account of the vault. */
    address: `0x${string}`;
    /** Accounts of the wallet unlocked by this passkey, never empty. */
    accounts: StoredVaultAccount[];
    /** Identifier of the passkey. */
    credentialId: string;
    /**
     * Raw identifier of the passkey, in base64url, when it differs from
     * `credentialId`.
     */
    rawCredentialId?: string;
    /** Name of the vault. */
    name: string;
    /** WebAuthn transports of the passkey, to suggest how to reach it. */
    transports: string[];
    /**
     * Kind and label of the device holding the passkey, guessed when it was
     * registered.
     */
    passkeyDevice: {
        kind: 'macos' | 'ios' | 'ipados' | 'windows' | 'android' | 'linux' | 'security-key' | 'cross-device' | 'platform' | 'passkey';
        label: string;
    };
    /** ISO 8601 date of the registration. */
    createdAt: string;
    /** ISO 8601 date of the last unlock, if any. */
    lastUsedAt: string | null;
    /** The encrypted recovery phrase and wallet encryption key. */
    envelope: PasskeyVaultEnvelopeData;
};
/** A list of vault records, as stored or exported. */
export type VaultRegistry = {
    /** Version of the registry format. */
    version: 1;
    /** The vault records. */
    vaults: StoredVaultRecord[];
};
/**
 * Check that a value is a valid vault record.
 *
 * @param value - The value to check.
 */
export declare const isStoredVaultRecord: (value: unknown) => value is StoredVaultRecord;
/**
 * Read a vault registry, dropping invalid records.
 *
 * @param value - The registry, parsed from JSON.
 * @throws When the value is not a registry of a supported version.
 */
export declare const parseVaultRegistry: (value: unknown) => VaultRegistry;
/**
 * Wrap vault records in a registry.
 *
 * @param vaults - The vault records.
 */
export declare const createVaultRegistry: (vaults: StoredVaultRecord[]) => VaultRegistry;
/**
 * Serialize vault records as a registry in JSON.
 *
 * @param vaults - The vault records.
 * @param space - Indentation of the JSON.
 */
export declare const serializeVaultRegistry: (vaults: StoredVaultRecord[], space?: number) => string;
/**
 * Check whether a vault holds an account, ignoring the case of the address.
 *
 * @param vault - The vault record.
 * @param address - The address of the account.
 */
export declare const vaultHasAccount: (vault: StoredVaultRecord, address: string) => boolean;
/**
 * Add a vault record, or replace the record of the same passkey, and put it
 * first.
 *
 * @param input - The vault records and the record to add.
 */
export declare const upsertVaultRecord: ({ vaults, record }: {
    vaults: StoredVaultRecord[];
    record: StoredVaultRecord;
}) => StoredVaultRecord[];
/**
 * Add an account to every vault of the wallet that holds another account.
 *
 * @param input - The vault records, an account the wallet already holds, and
 * the account to add.
 */
export declare const addAccountToVaultRecords: ({ vaults, sourceAddress, account }: {
    vaults: StoredVaultRecord[];
    sourceAddress: `0x${string}`;
    account: StoredVaultAccount;
}) => StoredVaultRecord[];
/**
 * Remove the vault record of a passkey.
 *
 * @param input - The vault records and the identifier of the passkey.
 */
export declare const removeVaultRecord: ({ vaults, credentialId }: {
    vaults: StoredVaultRecord[];
    credentialId: string;
}) => StoredVaultRecord[];
/**
 * Remove the vault records of several passkeys.
 *
 * @param input - The vault records and the identifiers of the passkeys.
 */
export declare const removeVaultRecords: ({ vaults, credentialIds }: {
    vaults: StoredVaultRecord[];
    credentialIds: Set<string>;
}) => StoredVaultRecord[];
/**
 * Remove an account from every vault, and the vaults left without accounts.
 *
 * @remarks
 * This only removes local records. Without a remaining vault or exported
 * recovery phrase, the account can no longer be unlocked.
 * @param input - The vault records and the address of the account.
 */
export declare const removeAccountFromVaultRecords: ({ vaults, address }: {
    vaults: StoredVaultRecord[];
    address: `0x${string}`;
}) => StoredVaultRecord[];
/**
 * Set the date of the last unlock of a vault.
 *
 * @param input - The vault records, the identifier of the passkey, and the
 * date, now by default.
 */
export declare const markVaultRecordUsed: ({ vaults, credentialId, usedAt }: {
    vaults: StoredVaultRecord[];
    credentialId: string;
    usedAt?: string;
}) => StoredVaultRecord[];
