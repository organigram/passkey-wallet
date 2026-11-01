import {
  localWalletOptOutParam,
  officialLocalWalletOrigin,
  officialWalletOrigin,
  passkeyWalletLocalHandoffType,
  passkeyWalletReadyType
} from '@organigram/passkey-wallet/wallet-origin'
import { getWalletRuntimeConfig } from './runtimeConfig'

const localWalletEnabledKey = 'passkey-wallet.useLocalWallet'

export const localWalletInstructionsUrl = (githubUrl: string): string =>
  `${githubUrl}#run-your-own-wallet`

/**
 * The copy of this wallet that users can run locally: configured by the
 * deployment, or the official one for wallet.organigram.ai.
 */
const getLocalCopyOrigin = (): string | null => {
  const configured = getWalletRuntimeConfig().localWalletOrigin
  if (configured !== '') return configured
  return [officialWalletOrigin, officialLocalWalletOrigin].includes(
    window.location.origin
  )
    ? officialLocalWalletOrigin
    : null
}

/** A deployment with a local copy can hand its requests to it. */
export const canHandOffToLocalWallet = (): boolean => {
  const localCopyOrigin = getLocalCopyOrigin()
  return localCopyOrigin != null && window.location.origin !== localCopyOrigin
}

const isLocalCopy = (): boolean =>
  window.location.origin === getLocalCopyOrigin()

/** The host name users see for the local copy. */
export const getLocalWalletHost = (): string => {
  const localCopyOrigin = getLocalCopyOrigin()
  return localCopyOrigin == null ? '' : new URL(localCopyOrigin).hostname
}

export const isLocalWalletEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(localWalletEnabledKey) === 'true'
  } catch {
    return false
  }
}

export const setLocalWalletEnabled = (enabled: boolean): void => {
  try {
    if (enabled) window.localStorage.setItem(localWalletEnabledKey, 'true')
    else window.localStorage.removeItem(localWalletEnabledKey)
  } catch {}
}

const getRequestingAppOrigin = (url: URL): string | null => {
  const value =
    url.searchParams.get('appOrigin') ?? url.searchParams.get('challengeUrl')
  try {
    return value == null ? null : new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Runs once the runtime config is loaded, before the wallet code loads. On a
 * deployment, hands the request to its local copy when the user chose it on
 * this device; on the local copy, tells the app that opened the request that
 * the copy is up. Returns true when the page navigates away.
 */
export const announceRequestPage = (): boolean => {
  const url = new URL(window.location.href)
  const requestId = url.searchParams.get('requestId')
  const appOrigin = getRequestingAppOrigin(url)
  const opener = window.opener as Window | null
  const localCopyOrigin = getLocalCopyOrigin()
  if (
    url.pathname !== '/request' ||
    requestId == null ||
    appOrigin == null ||
    opener == null ||
    localCopyOrigin == null
  ) {
    return false
  }

  if (
    canHandOffToLocalWallet() &&
    isLocalWalletEnabled() &&
    url.searchParams.get(localWalletOptOutParam) !== 'off'
  ) {
    opener.postMessage(
      { type: passkeyWalletLocalHandoffType, version: 1, requestId },
      appOrigin
    )
    window.location.replace(
      new URL(`${url.pathname}${url.search}`, localCopyOrigin)
    )
    return true
  }

  // Only the local copy announces itself: apps wait for it before falling
  // back to the deployment, which never sends this message.
  if (isLocalCopy()) {
    opener.postMessage(
      { type: passkeyWalletReadyType, version: 1, requestId },
      appOrigin
    )
  }
  return false
}
