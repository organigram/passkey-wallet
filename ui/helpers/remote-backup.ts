import type { RemoteVaultBackupRecord } from '@organigram/passkey-wallet/backup'
import { getWalletRuntimeConfig } from './runtimeConfig'

export {
  createRemoteVaultBackupPackage,
  createRemoteVaultBackupRecord,
  createVaultBackupDigest,
  createVaultBackupSignatureMessage,
  decryptRemoteVaultBackupRecord,
  normalizeBackupAddress,
  parseRemoteVaultBackupPackage,
  type RemoteVaultBackupPackage,
  type RemoteVaultBackupRecord
} from '@organigram/passkey-wallet/backup'

type RemoteVaultBackupResponse = {
  version: 1
  address: `0x${string}`
  backups: RemoteVaultBackupRecord[]
  exportedAt: string
  updatedAt?: string | null
}

type StoreRemoteVaultBackupResponse = {
  version: 1
  address: `0x${string}`
  count: number
  digest: string
}

export type PasskeyWalletSessionResponse = {
  authenticated: boolean
  address: `0x${string}` | null
  authProvider: string | null
}

export const passkeyWalletSessionUnavailableEvent =
  'organigram-passkey-wallet:session-unavailable'

export type PasskeyWalletSessionUnavailableEventDetail = {
  origin: string
  address: `0x${string}` | null
}

export class RemoteVaultBackupError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RemoteVaultBackupError'
    this.status = status
  }
}

const normalizeStackOrigin = (value: string): string => new URL(value).origin

const getDefaultStackOrigin = (): string => {
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'local.organigram.ai'
  ) {
    return 'https://localhost:3000'
  }

  return 'https://organigram.ai'
}

export const getStackOrigin = (): string => {
  const configured = getWalletRuntimeConfig().stackOrigin
  if (configured.trim() !== '') {
    return normalizeStackOrigin(configured)
  }

  return getDefaultStackOrigin()
}

const readJsonResponse = async <Body>(response: Response): Promise<Body> => {
  const body = (await response.json().catch(() => null)) as
    | (Body & { error?: string })
    | null
  if (!response.ok || body == null) {
    throw new RemoteVaultBackupError(
      body?.error ?? `Remote vault backup request failed (${response.status}).`,
      response.status
    )
  }

  return body
}

export const fetchRemoteVaultBackups = async (
  address: `0x${string}`
): Promise<RemoteVaultBackupResponse> => {
  const url = new URL('/api/wallet/vault-backups', getStackOrigin())
  url.searchParams.set('address', address)

  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'include'
  })
  return readJsonResponse<RemoteVaultBackupResponse>(response)
}

export const storeRemoteVaultBackups = async ({
  address,
  backups,
  message,
  signature
}: {
  address: `0x${string}`
  backups: RemoteVaultBackupRecord[]
  message: string
  signature: `0x${string}`
}): Promise<StoreRemoteVaultBackupResponse> => {
  const response = await fetch(
    new URL('/api/wallet/vault-backups', getStackOrigin()),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address,
        backups,
        message,
        signature
      })
    }
  )

  return readJsonResponse<StoreRemoteVaultBackupResponse>(response)
}

export const fetchPasskeyWalletSession = async (
  origin = getStackOrigin()
): Promise<PasskeyWalletSessionResponse> => {
  const response = await fetch(new URL('/api/wallet/session', origin), {
    cache: 'no-store',
    credentials: 'include'
  })

  return readJsonResponse<PasskeyWalletSessionResponse>(response)
}

export const revokePasskeyWalletSession = async ({
  address,
  origin = getStackOrigin()
}: {
  address: `0x${string}`
  origin?: string
}): Promise<PasskeyWalletSessionResponse> => {
  const response = await fetch(new URL('/api/wallet/session', origin), {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ address })
  })

  return readJsonResponse<PasskeyWalletSessionResponse>(response)
}
