import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { type PasskeyVaultEnvelopeData } from './crypto';
export declare const passkeyChallengeTtlMs: number;
export type PasskeyVaultEnvelopeInput = {
    address: string;
    encryptedVault: string;
    salt: string;
    nonce: string;
    algorithm: string;
    keyVersion: number;
};
export declare const validatePasskeyVaultEnvelopeInput: (input: PasskeyVaultEnvelopeInput) => PasskeyVaultEnvelopeInput & {
    address: `0x${string}`;
};
export type ValidatedPasskeyVaultEnvelope = ReturnType<typeof validatePasskeyVaultEnvelopeInput>;
export declare const createPasskeyChallengeExpiry: () => Date;
export declare const getWebAuthnClientDataChallenge: (response: unknown) => string;
export declare const createPasskeyRegistrationOptions: ({ rpId, rpName, userAddress, email }: {
    rpId: string;
    rpName?: string;
    userAddress?: string | null;
    email?: string | null;
}) => Promise<import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
type VerifiedPasskeyRegistrationResponse = Awaited<ReturnType<typeof verifyRegistrationResponse>> & {
    registrationInfo: NonNullable<Awaited<ReturnType<typeof verifyRegistrationResponse>>['registrationInfo']>;
};
export declare const verifyPasskeyRegistration: ({ response, expectedChallenge, expectedOrigin, expectedRpId, envelope }: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRpId: string;
    envelope: PasskeyVaultEnvelopeInput;
}) => Promise<{
    verification: VerifiedPasskeyRegistrationResponse;
    vaultEnvelope: ValidatedPasskeyVaultEnvelope;
}>;
export declare const createPasskeyAuthenticationOptions: ({ rpId, credentials }: {
    rpId: string;
    credentials?: Array<{
        credentialId: string;
        transports: string[];
    }>;
}) => Promise<import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
export declare const verifyPasskeyAuthentication: ({ response, expectedChallenge, expectedOrigin, expectedRpId, credential }: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRpId: string;
    credential: {
        credentialId: string;
        publicKey: string;
        signCount: number;
    };
}) => Promise<Awaited<ReturnType<typeof verifyAuthenticationResponse>>>;
export declare const toPasskeyVaultEnvelopeData: ({ encryptedVault, salt, nonce, algorithm, keyVersion }: {
    encryptedVault: string;
    salt: string;
    nonce: string;
    algorithm: string;
    keyVersion: number;
}) => PasskeyVaultEnvelopeData;
export {};
