import { getAddress } from 'viem'

import { fetchPasskeyWalletSession } from './remote-backup'

export type WalletConnectionRequestKind =
  | 'connect'
  | 'sign-in'
  | 'sign-message'

export type WalletConnectionRecord = {
  id: string
  version: 1
  kind: WalletConnectionRequestKind
  requestId: string
  domain: string
  appOrigin: string | null
  address: `0x${string}`
  chainId: number
  requestedAt: string
  completedAt: string
  revokedAt: string | null
}

export type WalletPendingConnectionRequest = {
  id: string
  version: 1
  kind: WalletConnectionRequestKind
  requestId: string
  domain: string
  appOrigin: string | null
  address: `0x${string}` | null
  chainId: number | null
  requestedAt: string
  expiresAt: string
  requestUrl: string
}

export const isActiveWalletConnectionKind = (
  kind: WalletConnectionRequestKind
): boolean => kind === 'connect' || kind === 'sign-in'

export type RecordWalletConnectionInput = {
  kind: WalletConnectionRequestKind
  requestId: string
  domain: string
  appOrigin?: string | null
  address: `0x${string}`
  chainId: number
  requestedAt: string
  completedAt: string
}

export type RecordWalletPendingConnectionInput = {
  kind: WalletConnectionRequestKind
  requestId: string
  domain: string
  appOrigin?: string | null
  address?: `0x${string}` | null
  chainId?: number | null
  requestedAt: string
  expiresAt?: string
  requestUrl: string
}

export const walletPendingConnectionRequestTtlMs = 5 * 60 * 1000
export const walletConnectionSessionSyncGraceMs = 60_000
export const walletConnectionsStorageKey =
  'organigram.passkeyWallet.connections.v1'
export const walletPendingConnectionsStorageKey =
  'organigram.passkeyWallet.pendingConnections.v1'

const getConnectionId = ({
  domain,
  appOrigin,
  address,
  chainId
}: {
  domain: string
  appOrigin: string | null
  address: `0x${string}`
  chainId: number
}): string =>
  [
    domain.trim().toLowerCase(),
    appOrigin?.trim().toLowerCase() ?? '',
    address.toLowerCase(),
    chainId
  ].join(':')

const getPendingConnectionId = ({
  kind,
  requestId
}: {
  kind: WalletConnectionRequestKind
  requestId: string
}): string => `${kind}:${requestId}`

const getPendingConnectionExpiresAt = ({
  expiresAt,
  requestedAt
}: {
  expiresAt?: string
  requestedAt: string
}): string => {
  if (typeof expiresAt === 'string' && expiresAt.trim() !== '') {
    return expiresAt
  }

  const requestedAtTime = Date.parse(requestedAt)
  const fallbackTime = Number.isFinite(requestedAtTime)
    ? requestedAtTime
    : Date.now()

  return new Date(fallbackTime + walletPendingConnectionRequestTtlMs).toISOString()
}

export const isWalletPendingConnectionRequestExpired = (
  request: WalletPendingConnectionRequest,
  now = Date.now()
): boolean => {
  const expiresAtTime = Date.parse(request.expiresAt)
  return Number.isFinite(expiresAtTime) && expiresAtTime <= now
}

export const assertWalletRequestNotExpired = (
  request: { request: { requestedAt: string } },
  now = Date.now()
): void => {
  const requestedAtTime = Date.parse(request.request.requestedAt)
  const expiresAtTime =
    (Number.isFinite(requestedAtTime) ? requestedAtTime : now) +
    walletPendingConnectionRequestTtlMs
  if (expiresAtTime <= now) {
    throw new Error('This wallet request has expired. Please retry from the app.')
  }
}

const parseWalletConnectionRecord = (
  value: unknown
): WalletConnectionRecord | null => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Partial<WalletConnectionRecord>
  if (
    record.version !== 1 ||
    (record.kind !== 'connect' &&
      record.kind !== 'sign-in' &&
      record.kind !== 'sign-message') ||
    typeof record.requestId !== 'string' ||
    typeof record.domain !== 'string' ||
    (typeof record.appOrigin !== 'string' && record.appOrigin !== null) ||
    typeof record.address !== 'string' ||
    typeof record.chainId !== 'number' ||
    !Number.isSafeInteger(record.chainId) ||
    record.chainId <= 0 ||
    typeof record.requestedAt !== 'string' ||
    typeof record.completedAt !== 'string' ||
    (typeof record.revokedAt !== 'string' && record.revokedAt !== null)
  ) {
    return null
  }

  const address = getAddress(record.address)
  const appOrigin = record.appOrigin?.trim() || null

  return {
    id: getConnectionId({
      domain: record.domain,
      appOrigin,
      address,
      chainId: record.chainId
    }),
    version: 1,
    kind: record.kind,
    requestId: record.requestId,
    domain: record.domain.trim().toLowerCase(),
    appOrigin,
    address,
    chainId: record.chainId,
    requestedAt: record.requestedAt,
    completedAt: record.completedAt,
    revokedAt: record.revokedAt
  }
}

const parseWalletPendingConnectionRequest = (
  value: unknown
): WalletPendingConnectionRequest | null => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const request = value as Partial<WalletPendingConnectionRequest>
  if (
    request.version !== 1 ||
    (request.kind !== 'connect' &&
      request.kind !== 'sign-in' &&
      request.kind !== 'sign-message') ||
    typeof request.requestId !== 'string' ||
    typeof request.domain !== 'string' ||
    (typeof request.appOrigin !== 'string' && request.appOrigin !== null) ||
    (typeof request.address !== 'string' && request.address !== null) ||
    (typeof request.chainId !== 'number' && request.chainId !== null) ||
    (typeof request.chainId === 'number' &&
      (!Number.isSafeInteger(request.chainId) || request.chainId <= 0)) ||
    typeof request.requestedAt !== 'string' ||
    (typeof request.expiresAt !== 'string' &&
      request.expiresAt !== undefined) ||
    typeof request.requestUrl !== 'string'
  ) {
    return null
  }

  return {
    id: getPendingConnectionId({
      kind: request.kind,
      requestId: request.requestId
    }),
    version: 1,
    kind: request.kind,
    requestId: request.requestId,
    domain: request.domain.trim().toLowerCase(),
    appOrigin: request.appOrigin?.trim() || null,
    address: request.address == null ? null : getAddress(request.address),
    chainId: request.chainId,
    requestedAt: request.requestedAt,
    expiresAt: getPendingConnectionExpiresAt({
      expiresAt: request.expiresAt,
      requestedAt: request.requestedAt
    }),
    requestUrl: request.requestUrl
  }
}

export const loadWalletConnectionRecords = (): WalletConnectionRecord[] => {
  try {
    const rawValue = window.localStorage.getItem(walletConnectionsStorageKey)
    if (rawValue == null || rawValue === '') return []

    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) return []

    const records = parsed
      .map(parseWalletConnectionRecord)
      .filter(
        (record): record is WalletConnectionRecord =>
          record != null &&
          isActiveWalletConnectionKind(record.kind) &&
          record.revokedAt == null
      )
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    if (records.length !== parsed.length) {
      saveWalletConnectionRecords(records)
    }

    return records
  } catch {
    return []
  }
}

export const loadWalletPendingConnectionRequests =
  (): WalletPendingConnectionRequest[] => {
    try {
      const rawValue = window.localStorage.getItem(
        walletPendingConnectionsStorageKey
      )
      if (rawValue == null || rawValue === '') return []

      const parsed = JSON.parse(rawValue) as unknown
      if (!Array.isArray(parsed)) return []

      const parsedRequests = parsed
        .map(parseWalletPendingConnectionRequest)
        .filter(
          (request): request is WalletPendingConnectionRequest =>
            request != null
        )
      const activeRequests = parsedRequests.filter(
        request => !isWalletPendingConnectionRequestExpired(request)
      )
      if (activeRequests.length !== parsedRequests.length) {
        window.localStorage.setItem(
          walletPendingConnectionsStorageKey,
          JSON.stringify(activeRequests)
        )
      }

      return activeRequests
        .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
    } catch {
      return []
    }
  }

const saveWalletConnectionRecords = (
  records: WalletConnectionRecord[]
): void => {
  window.localStorage.setItem(
    walletConnectionsStorageKey,
    JSON.stringify(records)
  )
}

const saveWalletPendingConnectionRequests = (
  requests: WalletPendingConnectionRequest[]
): void => {
  window.localStorage.setItem(
    walletPendingConnectionsStorageKey,
    JSON.stringify(requests)
  )
}

export const recordWalletPendingConnectionRequest = (
  input: RecordWalletPendingConnectionInput
): WalletPendingConnectionRequest[] => {
  const request: WalletPendingConnectionRequest = {
    id: getPendingConnectionId({
      kind: input.kind,
      requestId: input.requestId
    }),
    version: 1,
    kind: input.kind,
    requestId: input.requestId,
    domain: input.domain.trim().toLowerCase(),
    appOrigin: input.appOrigin?.trim() || null,
    address: input.address == null ? null : getAddress(input.address),
    chainId: input.chainId ?? null,
    requestedAt: input.requestedAt,
    expiresAt: getPendingConnectionExpiresAt({
      expiresAt: input.expiresAt,
      requestedAt: input.requestedAt
    }),
    requestUrl: input.requestUrl
  }
  const nextRequests = [
    request,
    ...loadWalletPendingConnectionRequests().filter(
      existingRequest => existingRequest.id !== request.id
    )
  ]
  saveWalletPendingConnectionRequests(nextRequests)

  return nextRequests
}

export const removeWalletPendingConnectionRequest = ({
  kind,
  requestId
}: {
  kind: WalletConnectionRequestKind
  requestId: string
}): WalletPendingConnectionRequest[] => {
  const id = getPendingConnectionId({ kind, requestId })
  const nextRequests = loadWalletPendingConnectionRequests().filter(
    request => request.id !== id
  )
  saveWalletPendingConnectionRequests(nextRequests)

  return nextRequests
}

export const recordWalletConnectionRequest = (
  input: RecordWalletConnectionInput
): WalletConnectionRecord[] => {
  if (!isActiveWalletConnectionKind(input.kind)) {
    return loadWalletConnectionRecords()
  }

  const address = getAddress(input.address)
  const domain = input.domain.trim().toLowerCase()
  const appOrigin = input.appOrigin?.trim() || null
  const id = getConnectionId({
    domain,
    appOrigin,
    address,
    chainId: input.chainId
  })
  const record: WalletConnectionRecord = {
    id,
    version: 1,
    kind: input.kind,
    requestId: input.requestId,
    domain,
    appOrigin,
    address,
    chainId: input.chainId,
    requestedAt: input.requestedAt,
    completedAt: input.completedAt,
    revokedAt: null
  }
  const existingRecords = loadWalletConnectionRecords()
  const nextRecords = [
    record,
    ...existingRecords.filter(
      existingRecord => {
        if (
          isActiveWalletConnectionKind(input.kind) &&
          isActiveWalletConnectionKind(existingRecord.kind) &&
          existingRecord.id === id
        ) {
          return false
        }

        return (
          existingRecord.requestId !== input.requestId ||
          existingRecord.kind !== input.kind
        )
      }
    )
  ]
  saveWalletConnectionRecords(nextRecords)

  return nextRecords
}

export const revokeWalletConnectionRecord = (
  id: string
): WalletConnectionRecord[] => {
  const nextRecords = loadWalletConnectionRecords().filter(
    record => record.id !== id
  )
  saveWalletConnectionRecords(nextRecords)

  return nextRecords
}

export const revokeActiveWalletConnectionRecord = ({
  domain,
  appOrigin,
  address,
  chainId
}: {
  domain: string
  appOrigin: string | null
  address: `0x${string}`
  chainId?: number
}): WalletConnectionRecord[] => {
  const normalizedDomain = domain.trim().toLowerCase()
  const normalizedAppOrigin = appOrigin?.trim().toLowerCase() ?? null
  const normalizedAddress = getAddress(address).toLowerCase()
  const nextRecords = loadWalletConnectionRecords().filter(record => {
    const matches =
      record.domain.trim().toLowerCase() === normalizedDomain &&
      (record.appOrigin?.trim().toLowerCase() ?? null) ===
        normalizedAppOrigin &&
      record.address.toLowerCase() === normalizedAddress &&
      (chainId == null || record.chainId === chainId)

    return !matches
  })
  saveWalletConnectionRecords(nextRecords)

  return nextRecords
}

export const revokeWalletConnectionRecordsForAppSession = ({
  appOrigin,
  address
}: {
  appOrigin: string
  address?: `0x${string}` | null
}): WalletConnectionRecord[] => {
  const normalizedAppOrigin = appOrigin.trim().toLowerCase()
  const normalizedAddress =
    address == null ? null : getAddress(address).toLowerCase()
  const nextRecords = loadWalletConnectionRecords().filter(record => {
    const matchesOrigin =
      (record.appOrigin?.trim().toLowerCase() ?? null) === normalizedAppOrigin
    const matchesAddress =
      normalizedAddress == null ||
      record.address.toLowerCase() === normalizedAddress

    return !(matchesOrigin && matchesAddress)
  })
  saveWalletConnectionRecords(nextRecords)

  return nextRecords
}

export const getActiveWalletConnectionRecord = ({
  domain,
  appOrigin,
  address,
  chainId
}: {
  domain: string
  appOrigin: string | null
  address: `0x${string}`
  chainId: number
}): WalletConnectionRecord | null => {
  const id = getConnectionId({
    domain,
    appOrigin,
    address: getAddress(address),
    chainId
  })

  return (
    loadWalletConnectionRecords().find(
      record =>
        record.id === id &&
        isActiveWalletConnectionKind(record.kind) &&
        record.revokedAt == null
    ) ?? null
  )
}

export const syncWalletConnectionRecordsForAppSessions = async ({
  records = loadWalletConnectionRecords(),
  now = Date.now()
}: {
  records?: WalletConnectionRecord[]
  now?: number
} = {}): Promise<WalletConnectionRecord[]> => {
  let nextRecords = records
  for (const record of nextRecords) {
    if (record.revokedAt != null || record.appOrigin == null) {
      continue
    }

    const completedAtTime = Date.parse(record.completedAt)
    if (
      isActiveWalletConnectionKind(record.kind) &&
      Number.isFinite(completedAtTime) &&
      now - completedAtTime < walletConnectionSessionSyncGraceMs
    ) {
      continue
    }

    try {
      const session = await fetchPasskeyWalletSession(record.appOrigin)
      if (
        !session.authenticated ||
        session.address?.toLowerCase() !== record.address.toLowerCase()
      ) {
        nextRecords = revokeWalletConnectionRecordsForAppSession({
          appOrigin: record.appOrigin,
          address: record.address
        })
      }
    } catch {
      // Keep the current state if the app does not expose wallet session checks.
    }
  }

  return nextRecords
}
