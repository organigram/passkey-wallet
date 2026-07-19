import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { getAddress, isAddress } from 'viem';
import { base64UrlToBytes, passkeyVaultAlgorithm, passkeyVaultKeyVersion } from './crypto';
export const passkeyChallengeTtlMs = 5 * 60 * 1000;
export const validatePasskeyVaultEnvelopeInput = (input) => {
    if (!isAddress(input.address)) {
        throw new Error('Passkey vault envelope requires a valid wallet address.');
    }
    if (input.encryptedMnemonic.trim() === '') {
        throw new Error('Passkey vault envelope requires encrypted recovery phrase data.');
    }
    if (input.salt.trim() === '') {
        throw new Error('Passkey vault envelope requires a salt.');
    }
    if (input.nonce.trim() === '') {
        throw new Error('Passkey vault envelope requires a nonce.');
    }
    if (input.algorithm !== passkeyVaultAlgorithm) {
        throw new Error('Passkey vault envelope algorithm is not supported.');
    }
    if (input.keyVersion !== passkeyVaultKeyVersion) {
        throw new Error('Passkey vault envelope key version is not supported.');
    }
    return {
        ...input,
        address: getAddress(input.address)
    };
};
export const createPasskeyChallengeExpiry = () => new Date(Date.now() + passkeyChallengeTtlMs);
export const getWebAuthnClientDataChallenge = (response) => {
    const clientDataJSON = response?.response?.clientDataJSON;
    if (typeof clientDataJSON !== 'string' || clientDataJSON === '') {
        throw new Error('WebAuthn response is missing client data.');
    }
    const clientData = JSON.parse(new TextDecoder().decode(base64UrlToBytes(clientDataJSON)));
    if (typeof clientData.challenge !== 'string' || clientData.challenge === '') {
        throw new Error('WebAuthn response is missing its challenge.');
    }
    return clientData.challenge;
};
export const createPasskeyRegistrationOptions = async ({ rpId, userAddress, email }) => await generateRegistrationOptions({
    rpName: 'Organigram',
    rpID: rpId,
    userName: email ?? userAddress ?? 'Organigram passkey wallet',
    userDisplayName: email ?? userAddress ?? 'Organigram passkey wallet',
    attestationType: 'none',
    authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required'
    },
    extensions: {
        prf: {
            eval: {
                first: new Uint8Array(32)
            }
        }
    }
});
export const verifyPasskeyRegistration = async ({ response, expectedChallenge, expectedOrigin, expectedRpId, envelope }) => {
    const vaultEnvelope = validatePasskeyVaultEnvelopeInput(envelope);
    const verification = await verifyRegistrationResponse({
        response: response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: expectedRpId,
        requireUserVerification: true
    });
    if (!verification.verified || verification.registrationInfo == null) {
        throw new Error('Passkey registration was not verified.');
    }
    return {
        verification: verification,
        vaultEnvelope
    };
};
export const createPasskeyAuthenticationOptions = async ({ rpId, credentials = [] }) => {
    const isDiscoverableAuthentication = credentials.length === 0;
    return await generateAuthenticationOptions({
        rpID: rpId,
        userVerification: 'required',
        ...(!isDiscoverableAuthentication
            ? {
                allowCredentials: credentials.map(credential => ({
                    id: credential.credentialId,
                    transports: credential.transports
                }))
            }
            : {}),
        extensions: {
            prf: isDiscoverableAuthentication
                ? {
                    eval: {
                        first: new Uint8Array(32)
                    }
                }
                : {
                    evalByCredential: Object.fromEntries(credentials.map(credential => [
                        credential.credentialId,
                        {
                            first: new Uint8Array(32)
                        }
                    ]))
                }
        }
    });
};
export const verifyPasskeyAuthentication = async ({ response, expectedChallenge, expectedOrigin, expectedRpId, credential }) => await verifyAuthenticationResponse({
    response: response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID: expectedRpId,
    credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.signCount
    },
    requireUserVerification: true
});
export const toPasskeyVaultEnvelopeData = ({ encryptedMnemonic, salt, nonce, algorithm, keyVersion }) => {
    if (algorithm !== passkeyVaultAlgorithm) {
        throw new Error('Passkey vault envelope algorithm is not supported.');
    }
    if (keyVersion !== passkeyVaultKeyVersion) {
        throw new Error('Passkey vault envelope key version is not supported.');
    }
    return {
        algorithm,
        keyVersion,
        ciphertext: encryptedMnemonic,
        salt,
        nonce
    };
};
