import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { type PasskeyVaultEnvelopeData } from './crypto';
export declare const passkeyChallengeTtlMs: number;
export type PasskeyVaultEnvelopeInput = {
    address: string;
    encryptedMnemonic: string;
    salt: string;
    nonce: string;
    algorithm: string;
    keyVersion: number;
};
export declare const validatePasskeyVaultEnvelopeInput: (input: PasskeyVaultEnvelopeInput) => PasskeyVaultEnvelopeInput & {
    address: `0x${string}`;
};
export declare const createPasskeyChallengeExpiry: () => Date;
export declare const getWebAuthnClientDataChallenge: (response: unknown) => string;
export declare const createPasskeyRegistrationOptions: ({ rpId, userAddress, email }: {
    rpId: string;
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
    vaultEnvelope: PasskeyVaultEnvelopeInput & {
        address: `0x${string}`;
    };
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
export declare const toPasskeyVaultEnvelopeData: ({ encryptedMnemonic, salt, nonce, algorithm, keyVersion }: {
    encryptedMnemonic: string;
    salt: string;
    nonce: string;
    algorithm: string;
    keyVersion: number;
}) => PasskeyVaultEnvelopeData;
export {};
