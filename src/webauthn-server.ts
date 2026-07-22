import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server'
import { getAddress, isAddress } from 'viem'

import {
  base64UrlToBytes,
  passkeyVaultAlgorithm,
  type PasskeyVaultEnvelopeData,
  passkeyVaultKeyVersion
} from './crypto'

export const passkeyChallengeTtlMs = 5 * 60 * 1000

export type PasskeyVaultEnvelopeInput = {
  address: string
  encryptedVault: string
  salt: string
  nonce: string
  algorithm: string
  keyVersion: number
}

export const validatePasskeyVaultEnvelopeInput = (
  input: PasskeyVaultEnvelopeInput
): PasskeyVaultEnvelopeInput & {
  address: `0x${string}`
} => {
  if (typeof input !== 'object' || input == null) {
    throw new Error('Passkey vault envelope is required.')
  }
  if (!isAddress(input.address)) {
    throw new Error('Passkey vault envelope requires a valid wallet address.')
  }
  if (
    typeof input.encryptedVault !== 'string' ||
    input.encryptedVault.trim() === ''
  ) {
    throw new Error('Passkey vault envelope requires encrypted vault data.')
  }
  if (typeof input.salt !== 'string' || input.salt.trim() === '') {
    throw new Error('Passkey vault envelope requires a salt.')
  }
  if (typeof input.nonce !== 'string' || input.nonce.trim() === '') {
    throw new Error('Passkey vault envelope requires a nonce.')
  }
  if (input.algorithm !== passkeyVaultAlgorithm) {
    throw new Error('Passkey vault envelope algorithm is not supported.')
  }
  if (input.keyVersion !== passkeyVaultKeyVersion) {
    throw new Error('Passkey vault envelope key version is not supported.')
  }

  return {
    ...input,
    address: getAddress(input.address as `0x${string}`),
  }
}

export type ValidatedPasskeyVaultEnvelope = ReturnType<
  typeof validatePasskeyVaultEnvelopeInput
>

export const createPasskeyChallengeExpiry = (): Date =>
  new Date(Date.now() + passkeyChallengeTtlMs)

export const getWebAuthnClientDataChallenge = (response: unknown): string => {
  const clientDataJSON = (response as {
    response?: {
      clientDataJSON?: string
    }
  })?.response?.clientDataJSON
  if (typeof clientDataJSON !== 'string' || clientDataJSON === '') {
    throw new Error('WebAuthn response is missing client data.')
  }

  const clientData = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(clientDataJSON))
  ) as {
    challenge?: unknown
  }
  if (typeof clientData.challenge !== 'string' || clientData.challenge === '') {
    throw new Error('WebAuthn response is missing its challenge.')
  }

  return clientData.challenge
}

export const createPasskeyRegistrationOptions = async ({
  rpId,
  rpName = 'Passkey Wallet',
  userAddress,
  email
}: {
  rpId: string
  rpName?: string
  userAddress?: string | null
  email?: string | null
}) =>
  await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: email ?? userAddress ?? `${rpName} passkey wallet`,
    userDisplayName: email ?? userAddress ?? `${rpName} passkey wallet`,
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
  } as Parameters<typeof generateRegistrationOptions>[0])

type VerifiedPasskeyRegistrationResponse = Awaited<
  ReturnType<typeof verifyRegistrationResponse>
> & {
  registrationInfo: NonNullable<
    Awaited<ReturnType<typeof verifyRegistrationResponse>>['registrationInfo']
  >
}

export const verifyPasskeyRegistration = async ({
  response,
  expectedChallenge,
  expectedOrigin,
  expectedRpId,
  envelope
}: {
  response: unknown
  expectedChallenge: string
  expectedOrigin: string
  expectedRpId: string
  envelope: PasskeyVaultEnvelopeInput
}): Promise<{
  verification: VerifiedPasskeyRegistrationResponse
  vaultEnvelope: ValidatedPasskeyVaultEnvelope
}> => {
  const vaultEnvelope = validatePasskeyVaultEnvelopeInput(envelope)
  const verification = await verifyRegistrationResponse({
    response: response as Parameters<
      typeof verifyRegistrationResponse
    >[0]['response'],
    expectedChallenge,
    expectedOrigin,
    expectedRPID: expectedRpId,
    requireUserVerification: true
  })

  if (!verification.verified || verification.registrationInfo == null) {
    throw new Error('Passkey registration was not verified.')
  }

  return {
    verification: verification as VerifiedPasskeyRegistrationResponse,
    vaultEnvelope
  }
}

export const createPasskeyAuthenticationOptions = async ({
  rpId,
  credentials = []
}: {
  rpId: string
  credentials?: Array<{
    credentialId: string
    transports: string[]
  }>
}) => {
  const isDiscoverableAuthentication = credentials.length === 0

  return await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'required',
    ...(!isDiscoverableAuthentication
      ? {
          allowCredentials: credentials.map(credential => ({
            id: credential.credentialId,
            transports: credential.transports as AuthenticatorTransport[]
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
            evalByCredential: Object.fromEntries(
              credentials.map(credential => [
                credential.credentialId,
                {
                  first: new Uint8Array(32)
                }
              ])
            )
          }
    }
  } as Parameters<typeof generateAuthenticationOptions>[0])
}

export const verifyPasskeyAuthentication = async ({
  response,
  expectedChallenge,
  expectedOrigin,
  expectedRpId,
  credential
}: {
  response: unknown
  expectedChallenge: string
  expectedOrigin: string
  expectedRpId: string
  credential: {
    credentialId: string
    publicKey: string
    signCount: number
  }
}): Promise<Awaited<ReturnType<typeof verifyAuthenticationResponse>>> =>
  await verifyAuthenticationResponse({
    response: response as Parameters<
      typeof verifyAuthenticationResponse
    >[0]['response'],
    expectedChallenge,
    expectedOrigin,
    expectedRPID: expectedRpId,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: credential.signCount
    },
    requireUserVerification: true
  })

export const toPasskeyVaultEnvelopeData = ({
  encryptedVault,
  salt,
  nonce,
  algorithm,
  keyVersion
}: {
  encryptedVault: string
  salt: string
  nonce: string
  algorithm: string
  keyVersion: number
}): PasskeyVaultEnvelopeData => {
  if (typeof encryptedVault !== 'string' || encryptedVault.trim() === '') {
    throw new Error('Passkey vault envelope requires encrypted vault data.')
  }
  if (typeof salt !== 'string' || salt.trim() === '') {
    throw new Error('Passkey vault envelope requires a salt.')
  }
  if (typeof nonce !== 'string' || nonce.trim() === '') {
    throw new Error('Passkey vault envelope requires a nonce.')
  }
  if (algorithm !== passkeyVaultAlgorithm) {
    throw new Error('Passkey vault envelope algorithm is not supported.')
  }
  if (keyVersion !== passkeyVaultKeyVersion) {
    throw new Error('Passkey vault envelope key version is not supported.')
  }

  return {
    algorithm,
    keyVersion,
    ciphertext: encryptedVault,
    salt,
    nonce
  }
}
