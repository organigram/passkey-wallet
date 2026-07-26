import {
  passkeyWalletConnectType,
  passkeyWalletDisconnectType,
  passkeyWalletSignMessageType,
  parsePasskeyWalletDisconnectRequest,
  parsePasskeyWalletRemoteRequest,
  type PasskeyWalletDisconnectRequest
} from '@organigram/passkey-wallet/remote-protocol'
import {
  parsePasskeyWalletSignInRequest,
  passkeyWalletSignInType
} from '@organigram/passkey-wallet/sign-in-protocol'
import { formatAddress } from '@organigram/passkey-wallet/vault-registry'

import type {
  RecordWalletPendingConnectionInput,
  WalletPendingConnectionRequest
} from './walletConnections'
import type { PendingWalletRequest } from './wallet'

export const activeVaultStorageKey = 'organigram.passkeyWallet.activeVaultId'

export const getStoredActiveVaultId = (): string | null => {
  if (typeof window === 'undefined') return null

  const value = window.localStorage.getItem(activeVaultStorageKey)
  return value == null || value.trim() === '' ? null : value
}

export const saveStoredActiveVaultId = (vaultId: string | null): void => {
  if (typeof window === 'undefined') return

  if (vaultId == null) {
    window.localStorage.removeItem(activeVaultStorageKey)
    return
  }

  window.localStorage.setItem(activeVaultStorageKey, vaultId)
}

export const getWalletAppRouteFlags = (pathname: string): {
  isRequestPage: boolean
  isSettingsPage: boolean
} => {
  const normalizedPathname = pathname.replace(/\/$/, '')

  return {
    isRequestPage: normalizedPathname === '/request',
    isSettingsPage: normalizedPathname === '/settings'
  }
}

export type InitialWalletLocationRequest =
  | {
      kind: 'none'
    }
  | {
      kind: 'disconnect'
      request: PasskeyWalletDisconnectRequest
      status: string
    }
  | {
      kind: 'pending'
      pendingRequest: PendingWalletRequest
      pendingConnectionRequest: RecordWalletPendingConnectionInput
      status: string
    }

export const parseInitialWalletLocationRequest = ({
  pathname,
  search
}: {
  pathname: string
  search: string
}): InitialWalletLocationRequest => {
  const params = new URLSearchParams(search)
  const requestUrl = `${pathname}${search}`
  const type = params.get('type')

  if (type === passkeyWalletDisconnectType) {
    const request = parsePasskeyWalletDisconnectRequest(params)
    return {
      kind: 'disconnect',
      request,
      status: `Disconnected ${formatAddress(request.address)} from ${request.domain}.`
    }
  }

  if (type === passkeyWalletSignInType) {
    const request = parsePasskeyWalletSignInRequest(params)
    return {
      kind: 'pending',
      pendingRequest: {
        kind: 'sign-in',
        request
      },
      pendingConnectionRequest: {
        kind: 'sign-in',
        requestId: request.requestId,
        domain: request.domain,
        appOrigin: new URL(request.challengeUrl).origin,
        chainId: null,
        requestedAt: request.requestedAt,
        requestUrl
      },
      status: `Review sign-in request from ${request.domain}.`
    }
  }

  if (type === passkeyWalletConnectType || type === passkeyWalletSignMessageType) {
    const request = parsePasskeyWalletRemoteRequest(params)
    return {
      kind: 'pending',
      pendingRequest: {
        kind: 'remote',
        request
      },
      pendingConnectionRequest: {
        kind:
          request.type === passkeyWalletConnectType ? 'connect' : 'sign-message',
        requestId: request.requestId,
        domain: request.domain,
        appOrigin: request.appOrigin,
        address: 'address' in request ? request.address : null,
        chainId: request.chainId,
        requestedAt: request.requestedAt,
        requestUrl
      },
      status: `Review wallet request from ${request.domain}.`
    }
  }

  return {
    kind: 'none'
  }
}

export const parsePendingWalletRequestFromConnectionRequest = (
  request: WalletPendingConnectionRequest,
  baseOrigin: string
): PendingWalletRequest => {
  const url = new URL(request.requestUrl, baseOrigin)
  const params = url.searchParams
  if (request.kind === 'sign-in') {
    return {
      kind: 'sign-in',
      request: parsePasskeyWalletSignInRequest(params)
    }
  }

  return {
    kind: 'remote',
    request: parsePasskeyWalletRemoteRequest(params)
  }
}

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
