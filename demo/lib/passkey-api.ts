import { NextResponse } from 'next/server'
import {
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  getWebAuthnClientDataChallenge,
  toPasskeyVaultEnvelopeData,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
  type PasskeyVaultEnvelopeInput
} from '@organigram/passkey-wallet/webauthn-server'

import {
  consumeChallenge,
  deleteCredential,
  getCredential,
  listCredentials,
  listCredentialsForAddress,
  listLocalCredentials,
  saveChallenge,
  saveCredential,
  updateCredentialCounter
} from './passkey-store'

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)

const normalizeHostname = (hostname: unknown): string =>
  typeof hostname === 'string'
    ? hostname.trim().replace(/^\./, '').toLowerCase()
    : ''

const inferPasskeyRpIdFromHostname = (hostname: unknown): string => {
  const normalizedHostname = normalizeHostname(hostname)
  if (normalizedHostname === '' || isLocalHostname(normalizedHostname)) {
    return normalizedHostname
  }

  const labels = normalizedHostname.split('.').filter(Boolean)
  const localLabelIndex = labels.indexOf('local')
  if (localLabelIndex >= 0 && labels.length - localLabelIndex > 2) {
    return labels.slice(localLabelIndex + 1).join('.')
  }

  return labels.length <= 2 ? normalizedHostname : labels.slice(-2).join('.')
}

const isHostnameCompatibleWithRpId = ({
  hostname,
  rpId
}: {
  hostname: string
  rpId: string
}): boolean =>
  (isLocalHostname(hostname) && isLocalHostname(rpId)) ||
  hostname === rpId ||
  hostname.endsWith(`.${rpId}`)

const isApiHostnameAllowedForOriginRpId = ({
  apiHostname,
  expectedRpId
}: {
  apiHostname: string
  expectedRpId: string
}): boolean => {
  const apiRpId = inferPasskeyRpIdFromHostname(apiHostname)
  if (apiRpId === '') return true
  if (isLocalHostname(apiHostname)) return true

  return isHostnameCompatibleWithRpId({
    hostname: expectedRpId,
    rpId: apiRpId
  })
}

const getOriginFromRequest = (request: Request): URL => {
  const originHeader = request.headers.get('origin')
  return new URL(
    originHeader == null ? new URL(request.url).origin : originHeader
  )
}

const getExpectedPasskeyRequest = (
  request: Request
): {
  expectedOrigin: string
  expectedRpId: string
} => {
  const origin = getOriginFromRequest(request)
  const apiHostname = new URL(request.url).hostname
  const expectedRpId = inferPasskeyRpIdFromHostname(origin.hostname)

  if (expectedRpId === '') {
    throw new Error('Passkey request RP ID could not be inferred.')
  }
  if (
    !isApiHostnameAllowedForOriginRpId({
      apiHostname,
      expectedRpId
    })
  ) {
    throw new Error('Passkey request origin is not allowed.')
  }
  if (
    !isHostnameCompatibleWithRpId({
      hostname: origin.hostname,
      rpId: expectedRpId
    })
  ) {
    throw new Error('Passkey request origin is not compatible with the RP ID.')
  }

  return {
    expectedOrigin: origin.origin,
    expectedRpId
  }
}

const getChallengeExpectedOrigin = (metadata: unknown): string => {
  if (typeof metadata !== 'object' || metadata == null) {
    throw new Error('Passkey challenge origin is missing.')
  }
  const expectedOrigin = (metadata as { expectedOrigin?: unknown })
    .expectedOrigin

  if (typeof expectedOrigin !== 'string' || expectedOrigin === '') {
    throw new Error('Passkey challenge origin is missing.')
  }

  return expectedOrigin
}

const getChallengeExpectedRpId = (metadata: unknown): string => {
  if (typeof metadata !== 'object' || metadata == null) {
    throw new Error('Passkey challenge RP ID is missing.')
  }
  const expectedRpId = (metadata as { expectedRpId?: unknown }).expectedRpId

  if (typeof expectedRpId !== 'string' || expectedRpId === '') {
    throw new Error('Passkey challenge RP ID is missing.')
  }

  return expectedRpId
}

const jsonError = (error: unknown): NextResponse =>
  NextResponse.json(
    { error: error instanceof Error ? error.message : String(error) },
    { status: 400 }
  )

const readJson = async <T>(request: Request): Promise<T> =>
  (await request.json().catch(() => ({}))) as T

const getRegistrationMetadata = (
  metadata: unknown
): {
  name?: string
} => {
  if (typeof metadata !== 'object' || metadata == null) return {}
  const name = (metadata as { name?: unknown }).name

  return typeof name === 'string' && name.trim() !== ''
    ? { name: name.trim() }
    : {}
}

export const handlePasskeyRegistrationOptions = async (
  request: Request
): Promise<NextResponse> => {
  try {
    const { expectedOrigin, expectedRpId } = getExpectedPasskeyRequest(request)
    const body = await readJson<{
      address?: string | null
      email?: string | null
      name?: string | null
    }>(request)
    const options = await createPasskeyRegistrationOptions({
      rpId: expectedRpId,
      rpName:
        process.env.PASSKEY_WALLET_RP_NAME?.trim() ||
        'Passkey Wallet Example',
      userAddress: body.address ?? null,
      email: body.email ?? null
    })

    saveChallenge({
      challenge: options.challenge,
      type: 'registration',
      userAddress: body.address ?? null,
      metadata: {
        expectedOrigin,
        expectedRpId,
        name: body.name ?? body.email ?? body.address ?? 'Passkey wallet'
      }
    })

    return NextResponse.json({ options })
  } catch (error) {
    return jsonError(error)
  }
}

export const handlePasskeyRegistrationVerify = async (
  request: Request
): Promise<NextResponse> => {
  try {
    const body = await readJson<{
      response?: unknown
      envelope?: PasskeyVaultEnvelopeInput
    }>(request)
    if (body.response == null || body.envelope == null) {
      throw new Error(
        'Passkey registration response and vault envelope are required.'
      )
    }

    const expectedChallenge = getWebAuthnClientDataChallenge(body.response)
    const challenge = consumeChallenge({
      challenge: expectedChallenge,
      type: 'registration'
    })
    const expectedOrigin = getChallengeExpectedOrigin(challenge.metadata)
    const expectedRpId = getChallengeExpectedRpId(challenge.metadata)
    const { verification, vaultEnvelope } = await verifyPasskeyRegistration({
      response: body.response,
      expectedChallenge,
      expectedOrigin,
      expectedRpId,
      envelope: body.envelope
    })
    const credential = verification.registrationInfo.credential
    const metadata = getRegistrationMetadata(challenge.metadata)

    saveCredential({
      userAddress: vaultEnvelope.address,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      signCount: credential.counter,
      transports: ((body.response as { response?: { transports?: string[] } })
        .response?.transports ?? []) as string[],
      name: metadata.name ?? 'Passkey wallet',
      vaultEnvelope
    })

    return NextResponse.json({
      address: vaultEnvelope.address,
      credentialId: credential.id
    })
  } catch (error) {
    return jsonError(error)
  }
}

export const handlePasskeyUnlockOptions = async (
  request: Request
): Promise<NextResponse> => {
  try {
    const { expectedOrigin, expectedRpId } = getExpectedPasskeyRequest(request)
    const credentials = listCredentials()
    const options = await createPasskeyAuthenticationOptions({
      rpId: expectedRpId,
      credentials: credentials.map(credential => ({
        credentialId: credential.credentialId,
        transports: credential.transports
      }))
    })

    saveChallenge({
      challenge: options.challenge,
      type: 'authentication',
      metadata: {
        expectedOrigin,
        expectedRpId
      }
    })

    return NextResponse.json({
      options,
      hasCredentials: credentials.length > 0
    })
  } catch (error) {
    return jsonError(error)
  }
}

export const handlePasskeyUnlockVerify = async (
  request: Request
): Promise<NextResponse> => {
  try {
    const body = await readJson<{
      response?: {
        id?: string
      }
    }>(request)
    if (body.response?.id == null || body.response.id === '') {
      throw new Error('Passkey authentication response is required.')
    }

    const expectedChallenge = getWebAuthnClientDataChallenge(body.response)
    const challenge = consumeChallenge({
      challenge: expectedChallenge,
      type: 'authentication'
    })
    const credential = getCredential(body.response.id)
    if (credential == null) {
      throw new Error('Passkey credential is not linked to a wallet.')
    }

    const verification = await verifyPasskeyAuthentication({
      response: body.response,
      expectedChallenge,
      expectedOrigin: getChallengeExpectedOrigin(challenge.metadata),
      expectedRpId: getChallengeExpectedRpId(challenge.metadata),
      credential
    })
    if (!verification.verified) {
      throw new Error('Passkey authentication was not verified.')
    }

    updateCredentialCounter({
      credentialId: credential.credentialId,
      signCount: verification.authenticationInfo.newCounter
    })

    return NextResponse.json({
      address: credential.userAddress,
      credentialId: credential.credentialId,
      envelope: toPasskeyVaultEnvelopeData(credential.vaultEnvelope)
    })
  } catch (error) {
    return jsonError(error)
  }
}

export const handlePasskeyCredentialsList = async (
  request: Request
): Promise<NextResponse> => {
  try {
    const address = new URL(request.url).searchParams.get('address')
    if (address == null || address === '') {
      return NextResponse.json({
        credentials: listLocalCredentials()
      })
    }
    if (!address.startsWith('0x')) {
      throw new Error('A wallet address is required to list passkeys.')
    }

    return NextResponse.json({
      credentials: listCredentialsForAddress(address as `0x${string}`)
    })
  } catch (error) {
    return jsonError(error)
  }
}

export const handlePasskeyCredentialDelete = async (
  request: Request
): Promise<NextResponse> => {
  try {
    const body = await readJson<{
      address?: string | null
      credentialId?: string | null
    }>(request)
    if (body.address == null || !body.address.startsWith('0x')) {
      throw new Error('A wallet address is required to delete a passkey.')
    }
    if (body.credentialId == null || body.credentialId === '') {
      throw new Error('A credential id is required to delete a passkey.')
    }

    deleteCredential({
      credentialId: body.credentialId,
      userAddress: body.address as `0x${string}`
    })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
