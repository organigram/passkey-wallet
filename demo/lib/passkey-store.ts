import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'

import { createPasskeyChallengeExpiry } from '@organigram/passkey-wallet/webauthn-server'
import type { PasskeyVaultEnvelopeInput } from '@organigram/passkey-wallet/webauthn-server'

type ChallengeType = 'registration' | 'authentication'

type StoredChallenge = {
  challenge: string
  type: ChallengeType
  userAddress: string | null
  metadata: unknown
  expiresAt: Date
  consumedAt: Date | null
}

type StoredCredential = {
  credentialId: string
  userAddress: `0x${string}`
  publicKey: string
  signCount: number
  transports: string[]
  name: string
  vaultEnvelope: PasskeyVaultEnvelopeInput & { address: `0x${string}` }
  createdAt: Date
  lastUsedAt: Date | null
}

type PersistedCredential = Omit<StoredCredential, 'createdAt' | 'lastUsedAt'> & {
  createdAt: string
  lastUsedAt: string | null
}

type PersistedStore = {
  version: 1
  credentials: PersistedCredential[]
}

export type ListedPasskeyCredential = {
  credentialId: string
  userAddress: `0x${string}`
  name: string
  transports: string[]
  createdAt: string
  lastUsedAt: string | null
}

const globalStore = globalThis as typeof globalThis & {
  __passkeyWalletExampleStore?: {
    challenges: Map<string, StoredChallenge>
    credentials: Map<string, StoredCredential>
  }
}

const storeFilePath = join(
  process.cwd(),
  '.passkey-wallet-store',
  'store.json'
)

const toStoredCredential = (
  credential: PersistedCredential
): StoredCredential => ({
  ...credential,
  createdAt: new Date(credential.createdAt),
  lastUsedAt:
    credential.lastUsedAt == null ? null : new Date(credential.lastUsedAt)
})

const readPersistedCredentials = (): Map<string, StoredCredential> => {
  if (!existsSync(storeFilePath)) {
    return new Map()
  }

  try {
    const payload = JSON.parse(readFileSync(storeFilePath, 'utf8')) as Partial<
      PersistedStore
    >
    if (payload.version !== 1 || !Array.isArray(payload.credentials)) {
      return new Map()
    }

    return new Map(
      payload.credentials.map(credential => [
        credential.credentialId,
        toStoredCredential(credential)
      ])
    )
  } catch (error) {
    console.warn('Unable to read passkey wallet demo store.', error)
    return new Map()
  }
}

const store =
  globalStore.__passkeyWalletExampleStore ??
  (globalStore.__passkeyWalletExampleStore = {
    challenges: new Map<string, StoredChallenge>(),
    credentials: readPersistedCredentials()
  })

const persistCredentialStore = (): void => {
  const payload: PersistedStore = {
    version: 1,
    credentials: Array.from(store.credentials.values()).map(credential => ({
      ...credential,
      createdAt: credential.createdAt.toISOString(),
      lastUsedAt: credential.lastUsedAt?.toISOString() ?? null
    }))
  }
  const temporaryStoreFilePath = `${storeFilePath}.tmp`

  mkdirSync(dirname(storeFilePath), { recursive: true })
  writeFileSync(temporaryStoreFilePath, `${JSON.stringify(payload, null, 2)}\n`)
  renameSync(temporaryStoreFilePath, storeFilePath)
}

const toListedPasskeyCredential = (
  credential: StoredCredential
): ListedPasskeyCredential => ({
  credentialId: credential.credentialId,
  userAddress: credential.userAddress,
  name: credential.name,
  transports: credential.transports,
  createdAt: credential.createdAt.toISOString(),
  lastUsedAt: credential.lastUsedAt?.toISOString() ?? null
})

export const saveChallenge = ({
  challenge,
  type,
  userAddress,
  metadata
}: {
  challenge: string
  type: ChallengeType
  userAddress?: string | null
  metadata?: unknown
}): void => {
  store.challenges.set(challenge, {
    challenge,
    type,
    userAddress: userAddress ?? null,
    metadata,
    expiresAt: createPasskeyChallengeExpiry(),
    consumedAt: null
  })
}

export const consumeChallenge = ({
  challenge,
  type
}: {
  challenge: string
  type: ChallengeType
}): StoredChallenge => {
  const storedChallenge = store.challenges.get(challenge)
  if (
    storedChallenge == null ||
    storedChallenge.type !== type ||
    storedChallenge.consumedAt != null ||
    storedChallenge.expiresAt < new Date()
  ) {
    throw new Error('Passkey challenge is missing or expired.')
  }

  storedChallenge.consumedAt = new Date()

  return storedChallenge
}

export const saveCredential = (
  credential: Omit<StoredCredential, 'createdAt' | 'lastUsedAt'>
): void => {
  store.credentials.set(credential.credentialId, {
    ...credential,
    createdAt: new Date(),
    lastUsedAt: null
  })
  persistCredentialStore()
}

export const getCredential = (
  credentialId: string
): StoredCredential | null => store.credentials.get(credentialId) ?? null

export const listCredentials = (): StoredCredential[] =>
  Array.from(store.credentials.values()).sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  )

export const listCredentialsForAddress = (
  userAddress: `0x${string}`
): ListedPasskeyCredential[] =>
  listCredentials()
    .filter(
      credential =>
        credential.userAddress.toLowerCase() === userAddress.toLowerCase()
    )
    .map(toListedPasskeyCredential)

export const listLocalCredentials = (): ListedPasskeyCredential[] =>
  listCredentials().map(toListedPasskeyCredential)

export const deleteCredential = ({
  credentialId,
  userAddress
}: {
  credentialId: string
  userAddress: `0x${string}`
}): void => {
  const credential = getCredential(credentialId)
  if (credential == null) {
    throw new Error('Passkey credential was not found.')
  }
  if (credential.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
    throw new Error('Passkey credential does not belong to this EOA.')
  }
  const remainingCredentials = listCredentials().filter(
    storedCredential =>
      storedCredential.userAddress.toLowerCase() ===
        userAddress.toLowerCase() &&
      storedCredential.credentialId !== credentialId
  )
  if (remainingCredentials.length === 0) {
    throw new Error('Keep at least one passkey for this EOA.')
  }

  store.credentials.delete(credentialId)
  persistCredentialStore()
}

export const updateCredentialCounter = ({
  credentialId,
  signCount
}: {
  credentialId: string
  signCount: number
}): void => {
  const credential = getCredential(credentialId)
  if (credential == null) return

  credential.signCount = signCount
  credential.lastUsedAt = new Date()
  persistCredentialStore()
}
