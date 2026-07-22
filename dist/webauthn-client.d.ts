import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { type PasskeyVaultEnvelopeData } from './crypto';
import type { OrganigramPasskeyCapabilities, PasskeyRegistrationResult, UnlockedPasskeyWallet } from './types';
import { parsePasskeyWalletVaultPayload, serializePasskeyWalletVaultPayload, type PasskeyWalletVaultPayload } from './vault';
export { parsePasskeyWalletVaultPayload, serializePasskeyWalletVaultPayload };
export type { OrganigramPasskeyCapabilities, UnlockedPasskeyWallet } from './types';
type PasskeyRegisterOptionsResponse = {
    options: Parameters<typeof startRegistration>[0]['optionsJSON'];
};
type PasskeyUnlockOptionsResponse = {
    options: Parameters<typeof startAuthentication>[0]['optionsJSON'];
    hasCredentials: boolean;
};
type PasskeyUnlockVerifyResponse = {
    address: `0x${string}`;
    credentialId: string;
    envelope: PasskeyVaultEnvelopeData;
};
type PasskeyRegistrationEnvelope = {
    address: `0x${string}`;
    encryptedVault: string;
    salt: string;
    nonce: string;
    algorithm: string;
    keyVersion: number;
};
export type PreparedPasskeyCredentialEnvelope = {
    address: `0x${string}`;
    credentialId: string | null;
    response: unknown;
    envelope: PasskeyRegistrationEnvelope;
};
export type PasskeyWalletApiClient = {
    registerOptions: (input: {
        address: `0x${string}`;
        email?: string | null;
        name?: string | null;
    }) => Promise<PasskeyRegisterOptionsResponse>;
    registerVerify: (input: {
        response: unknown;
        envelope: PasskeyRegistrationEnvelope;
    }) => Promise<PasskeyRegistrationResult>;
    unlockOptions: () => Promise<PasskeyUnlockOptionsResponse>;
    unlockVerify: (input: {
        response: unknown;
    }) => Promise<PasskeyUnlockVerifyResponse>;
};
export declare const createFetchPasskeyWalletApiClient: (basePath?: string) => PasskeyWalletApiClient;
export declare const hydratePasskeyPrfOptions: <T extends {
    extensions?: unknown;
}>(options: T) => T;
export declare function preparePasskeyCredentialEnvelope({ api, address, vaultPayload, email, name }: {
    api: PasskeyWalletApiClient;
    address: `0x${string}`;
    vaultPayload: PasskeyWalletVaultPayload;
    email?: string | null;
    name?: string | null;
}): Promise<PreparedPasskeyCredentialEnvelope>;
export declare function submitPasskeyCredentialEnvelope({ api, registration }: {
    api: PasskeyWalletApiClient;
    registration: PreparedPasskeyCredentialEnvelope;
}): Promise<PasskeyRegistrationResult>;
export declare function registerPasskeyCredentialEnvelope({ api, address, vaultPayload, email, name }: {
    api: PasskeyWalletApiClient;
    address: `0x${string}`;
    vaultPayload: PasskeyWalletVaultPayload;
    email?: string | null;
    name?: string | null;
}): Promise<PasskeyRegistrationResult>;
export declare const registerPasskeyWallet: ({ api, capabilities }: {
    api: PasskeyWalletApiClient;
    capabilities: OrganigramPasskeyCapabilities;
}) => Promise<UnlockedPasskeyWallet>;
export declare const unlockPasskeyWallet: ({ api }: {
    api: PasskeyWalletApiClient;
}) => Promise<UnlockedPasskeyWallet | null>;
export declare const exportPasskeyWalletRecoveryPhrase: ({ api, expectedAddress }: {
    api: PasskeyWalletApiClient;
    expectedAddress: `0x${string}`;
}) => Promise<string>;
export declare const exportPasskeyWalletSeedPhrase: ({ api, expectedAddress }: {
    api: PasskeyWalletApiClient;
    expectedAddress: `0x${string}`;
}) => Promise<string>;
export declare const registerAdditionalPasskeyCredential: ({ api, wallet, name }: {
    api: PasskeyWalletApiClient;
    wallet: UnlockedPasskeyWallet;
    name?: string;
}) => Promise<PasskeyRegistrationResult>;
export declare const isPasskeyCredentialUnavailableError: (error: unknown) => boolean;
export declare const unlockOrCreatePasskeyWallet: ({ api, capabilities }: {
    api: PasskeyWalletApiClient;
    capabilities: OrganigramPasskeyCapabilities;
    targetChainId: number;
}) => Promise<UnlockedPasskeyWallet>;
