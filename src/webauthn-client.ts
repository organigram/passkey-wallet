import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

import {
  base64UrlToBytes,
  decryptPasskeyVaultSecret,
  derivePasskeyVaultKey,
  encryptPasskeyVaultSecret,
  type PasskeyVaultEnvelopeData
} from './crypto'
import { PasskeyPrfUnavailableError } from './errors'
import type {
  OrganigramPasskeyCapabilities,
  PasskeyRegistrationResult,
  UnlockedPasskeyWallet
} from './types'
import { createNewPasskeyWalletVault, createUnlockedPasskeyWallet } from './wallet'
import {
  parsePasskeyWalletVaultPayload,
  serializePasskeyWalletVaultPayload,
  type PasskeyWalletVaultPayload
} from './vault'

export {
  parsePasskeyWalletVaultPayload,
  serializePasskeyWalletVaultPayload
}
export type { OrganigramPasskeyCapabilities, UnlockedPasskeyWallet } from './types'

type PasskeyRegisterOptionsResponse = {
  options: Parameters<typeof startRegistration>[0]['optionsJSON']
}

type PasskeyUnlockOptionsResponse = {
  options: Parameters<typeof startAuthentication>[0]['optionsJSON']
  hasCredentials: boolean
}

type PasskeyUnlockVerifyResponse = {
  address: `0x${string}`
  credentialId: string
  envelope: PasskeyVaultEnvelopeData
}

type PasskeyExtensionResults = {
  prf?: {
    results?: {
      first?: string | ArrayBuffer
    }
  }
}

type PasskeyPrfValue =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | number[]
  | Record<string, number>

export type PasskeyWalletApiClient = {
  registerOptions: (input: {
    address: `0x${string}`
    email?: string | null
    name?: string | null
  }) => Promise<PasskeyRegisterOptionsResponse>
  registerVerify: (input: {
    response: unknown
    envelope: {
      address: `0x${string}`
      encryptedMnemonic: string
      salt: string
      nonce: string
      algorithm: string
      keyVersion: number
    }
  }) => Promise<PasskeyRegistrationResult>
  unlockOptions: () => Promise<PasskeyUnlockOptionsResponse>
  unlockVerify: (input: {
    response: unknown
  }) => Promise<PasskeyUnlockVerifyResponse>
}

const readJson = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & T)
    | null

  if (!response.ok) {
    throw new Error(
      body?.error ?? `Request failed with status ${response.status}`
    )
  }

  return body as T
}

const postJson = async <T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  return await readJson<T>(response)
}

export const createFetchPasskeyWalletApiClient = (
  basePath = '/api/auth/passkey'
): PasskeyWalletApiClient => ({
  registerOptions: async input =>
    await postJson<PasskeyRegisterOptionsResponse>(
      `${basePath}/register/options`,
      input
    ),
  registerVerify: async input =>
    await postJson<PasskeyRegistrationResult>(
      `${basePath}/register/verify`,
      input
    ),
  unlockOptions: async () =>
    await postJson<PasskeyUnlockOptionsResponse>(
      `${basePath}/unlock/options`,
      {}
    ),
  unlockVerify: async input =>
    await postJson<PasskeyUnlockVerifyResponse>(
      `${basePath}/unlock/verify`,
      input
    )
})

const hydrateSerializedPrfValue = (value: unknown): unknown => {
  if (value == null) return value
  if (typeof value === 'string') return base64UrlToBytes(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (Array.isArray(value)) return new Uint8Array(value)
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (
      entries.every(
        ([key, entryValue]) =>
          /^\d+$/.test(key) && typeof entryValue === 'number'
      )
    ) {
      return new Uint8Array(
        entries
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([, entryValue]) => entryValue as number)
      )
    }
  }

  return value
}

const hydratePrfValueSet = <T extends { first?: unknown; second?: unknown }>(
  valueSet: T | undefined
): T | undefined => {
  if (valueSet == null) return valueSet

  return {
    ...valueSet,
    first: hydrateSerializedPrfValue(valueSet.first) as PasskeyPrfValue,
    ...(valueSet.second != null
      ? {
          second: hydrateSerializedPrfValue(valueSet.second) as PasskeyPrfValue
        }
      : {})
  }
}

export const hydratePasskeyPrfOptions = <T extends { extensions?: unknown }>(
  options: T
): T => {
  const extensions = options.extensions as
    | {
        prf?: {
          eval?: { first?: unknown; second?: unknown }
          evalByCredential?: Record<
            string,
            { first?: unknown; second?: unknown }
          >
        }
      }
    | undefined
  const prf = extensions?.prf
  if (prf == null) return options

  return {
    ...options,
    extensions: {
      ...extensions,
      prf: {
        ...prf,
        ...(prf.eval != null ? { eval: hydratePrfValueSet(prf.eval) } : {}),
        ...(prf.evalByCredential != null
          ? {
              evalByCredential: Object.fromEntries(
                Object.entries(prf.evalByCredential).map(
                  ([credentialId, valueSet]) => [
                    credentialId,
                    hydratePrfValueSet(valueSet)
                  ]
                )
              )
            }
          : {})
      }
    }
  }
}

const getPasskeyPrfOutput = (response: unknown): Uint8Array => {
  const first = (
    response as {
      clientExtensionResults?: PasskeyExtensionResults
    }
  ).clientExtensionResults?.prf?.results?.first
  if (first == null || first === '') {
    throw new PasskeyPrfUnavailableError()
  }

  return typeof first === 'string'
    ? base64UrlToBytes(first)
    : new Uint8Array(first)
}

export async function registerPasskeyCredentialEnvelope({
  api,
  address,
  vaultPayload,
  email,
  name
}: {
  api: PasskeyWalletApiClient
  address: `0x${string}`
  vaultPayload: PasskeyWalletVaultPayload
  email?: string | null
  name?: string | null
}): Promise<PasskeyRegistrationResult> {
  const { options } = await api.registerOptions({
    address,
    email,
    name
  })
  const registrationResponse = await startRegistration({
    optionsJSON: hydratePasskeyPrfOptions(options)
  })
  const prfOutput = getPasskeyPrfOutput(registrationResponse)
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const key = await derivePasskeyVaultKey({
    prfOutput,
    salt
  })
  const envelope = await encryptPasskeyVaultSecret({
    plaintext: serializePasskeyWalletVaultPayload(vaultPayload),
    key,
    salt
  })

  return await api.registerVerify({
    response: registrationResponse,
    envelope: {
      address,
      encryptedMnemonic: envelope.ciphertext,
      salt: envelope.salt,
      nonce: envelope.nonce,
      algorithm: envelope.algorithm,
      keyVersion: envelope.keyVersion
    }
  })
}

export const registerPasskeyWallet = async ({
  api,
  capabilities
}: {
  api: PasskeyWalletApiClient
  capabilities: OrganigramPasskeyCapabilities
}): Promise<UnlockedPasskeyWallet> => {
  const { address, vaultPayload } = await createNewPasskeyWalletVault({
    capabilities
  })
  const credential = await registerPasskeyCredentialEnvelope({
    api,
    address,
    vaultPayload,
    email: capabilities.identity?.email ?? null,
    name: capabilities.name ?? capabilities.identity?.email ?? null
  })

  return createUnlockedPasskeyWallet({
    address: credential.address,
    credentialId: credential.credentialId,
    vaultPayload
  })
}

export const unlockPasskeyWallet = async ({
  api
}: {
  api: PasskeyWalletApiClient
}): Promise<UnlockedPasskeyWallet | null> => {
  const { options, hasCredentials } = await api.unlockOptions()
  if (!hasCredentials) return null

  const authenticationResponse = await startAuthentication({
    optionsJSON: hydratePasskeyPrfOptions(options)
  })
  const prfOutput = getPasskeyPrfOutput(authenticationResponse)
  const result = await api.unlockVerify({
    response: authenticationResponse
  })
  const key = await derivePasskeyVaultKey({
    prfOutput,
    salt: base64UrlToBytes(result.envelope.salt)
  })
  const vaultPlaintext = await decryptPasskeyVaultSecret({
    envelope: result.envelope,
    key
  })
  const vaultPayload = parsePasskeyWalletVaultPayload(vaultPlaintext)
  const wallet = createUnlockedPasskeyWallet({
    address: result.address,
    credentialId: result.credentialId,
    vaultPayload
  })

  if (wallet.account.address.toLowerCase() !== result.address.toLowerCase()) {
    throw new Error('Passkey wallet envelope does not match its address.')
  }

  return wallet
}

export const exportPasskeyWalletRecoveryPhrase = async ({
  api,
  expectedAddress
}: {
  api: PasskeyWalletApiClient
  expectedAddress: `0x${string}`
}): Promise<string> => {
  const wallet = await unlockPasskeyWallet({ api })
  if (wallet == null) {
    throw new Error('No passkey wallet is available to export.')
  }
  if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error('Selected passkey does not unlock this wallet.')
  }

  return wallet.recoveryPhrase
}

export const registerAdditionalPasskeyCredential = async ({
  api,
  wallet,
  name
}: {
  api: PasskeyWalletApiClient
  wallet: UnlockedPasskeyWallet
  name?: string
}): Promise<PasskeyRegistrationResult> =>
  await registerPasskeyCredentialEnvelope({
    api,
    address: wallet.address,
    vaultPayload: {
      version: 1,
      recoveryPhrase: wallet.recoveryPhrase,
      userEncryptionPrivateKey: wallet.userEncryptionPrivateKey,
      userEncryptionPublicKey: wallet.userEncryptionPublicKey,
      userEncryptionKeyVersion: wallet.userEncryptionKeyVersion
    },
    name: name ?? 'Backup passkey'
  })

export const isPasskeyCredentialUnavailableError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error == null) return false

  const { name, message } = error as { name?: unknown; message?: unknown }
  const normalizedName = typeof name === 'string' ? name.toLowerCase() : ''
  const normalizedMessage =
    typeof message === 'string' ? message.toLowerCase() : ''

  return (
    normalizedName === 'notallowederror' ||
    normalizedName === 'invalidstateerror' ||
    normalizedMessage.includes('no credentials') ||
    normalizedMessage.includes('not allowed') ||
    normalizedMessage.includes('could not be completed')
  )
}

export const unlockOrCreatePasskeyWallet = async ({
  api,
  capabilities
}: {
  api: PasskeyWalletApiClient
  capabilities: OrganigramPasskeyCapabilities
  targetChainId: number
}): Promise<UnlockedPasskeyWallet> => {
  if (typeof window === 'undefined' || window.PublicKeyCredential == null) {
    throw new Error('Passkeys are not available in this browser.')
  }

  if (capabilities.method !== 'register') {
    try {
      const wallet = await unlockPasskeyWallet({ api })
      if (wallet != null) return wallet
    } catch (error) {
      if (!isPasskeyCredentialUnavailableError(error)) {
        throw error
      }
    }
  }

  return await registerPasskeyWallet({
    api,
    capabilities: {
      ...capabilities,
      method: 'register'
    }
  })
}
