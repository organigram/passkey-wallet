import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import { createWalletEncryptionPublicKeySiweResource } from '@organigram/passkey-wallet'
import {
  assertSignInDomainMatches,
  type PasskeyWalletSignInRequest,
  type PasskeyWalletSignInResult
} from '@organigram/passkey-wallet/sign-in-protocol'
import type {
  PasskeyWalletConnectResult,
  PasskeyWalletRemoteRequest,
  PasskeyWalletSignMessageResult
} from '@organigram/passkey-wallet/remote-protocol'
import { getStackOrigin } from './remote-backup'

export {
  formatAddress,
  formatCredentialId,
  getNextAddressIndex,
  getVaultAccount,
  getVaultRegistryGroupId,
  groupVaultRecordsBySeed,
  groupVaultsByWallet,
  mergeVaults,
  type VaultRegistryGroup,
  type WalletGroup
} from '@organigram/passkey-wallet/vault-registry'

export type WalletChallenge = {
  domain: string
  nonce: string
  message: string
  expiresAt: string
}

export type PendingWalletRequest =
  | {
      kind: 'sign-in'
      request: PasskeyWalletSignInRequest
    }
  | {
      kind: 'remote'
      request: PasskeyWalletRemoteRequest
    }

export type AccountSetupView = 'import-seed' | 'restore'
export type WalletActionModal = 'receive' | 'send' | null
export type GasPriority = 'slow' | 'normal' | 'fast'
export type PortfolioCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CHF'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'SGD'
  | 'HKD'
  | 'SEK'
  | 'NOK'
  | 'DKK'
  | 'PLN'
  | 'BRL'
  | 'MXN'
  | 'INR'
export type PortfolioPeriod = '1' | '7' | '30' | '90' | '365'
export type TrackedWalletAsset = {
  id: string
  type: 'native' | 'token'
  networkKey: WalletNetworkKey
  name: string
  symbol: string
  decimals: number
  coingeckoId: string
  tokenAddress?: `0x${string}`
  enabled: boolean
}
export type TrackedWalletAssetGroup = {
  key: string
  symbol: string
  name: string
  assets: TrackedWalletAsset[]
}
export type WalletNetworkKey = string

export type RemoteBackupStatus =
  | {
      state: 'idle'
      label: string
      detail: string
    }
  | {
      state: 'checking'
      label: string
      detail: string
    }
  | {
      state: 'backed-up'
      label: string
      detail: string
    }
  | {
      state: 'missing' | 'outdated' | 'unavailable'
      label: string
      detail: string
    }

export const defaultWalletName = 'Account 1'
export * from './walletPortfolio'

export const openOrganigramSignIn = (): void => {
  const url = new URL(getStackOrigin())
  url.pathname = '/'
  window.open(url.toString(), 'organigram-stack', 'noopener,noreferrer')
}

export const formatDate = (value: string | null): string =>
  value == null ? 'Never' : new Date(value).toLocaleString()

export const buildChallengeUrl = ({
  challengeUrl,
  walletAddress,
  chainId,
  encryptionPublicKeyResource
}: {
  challengeUrl: string
  walletAddress: `0x${string}`
  chainId: number
  encryptionPublicKeyResource?: string
}): string => {
  const url = new URL(challengeUrl)
  if (!url.searchParams.has('address')) {
    url.searchParams.set('address', walletAddress)
  }
  if (!url.searchParams.has('chainId')) {
    url.searchParams.set('chainId', chainId.toString())
  }
  if (
    encryptionPublicKeyResource != null &&
    encryptionPublicKeyResource !== '' &&
    !url.searchParams.has('encryptionPublicKeyResource')
  ) {
    url.searchParams.set(
      'encryptionPublicKeyResource',
      encryptionPublicKeyResource
    )
  }

  return url.toString()
}

export const fetchWalletChallenge = async ({
  request,
  wallet,
  chainId
}: {
  request: PasskeyWalletSignInRequest
  wallet: UnlockedPasskeyWallet
  chainId: number
}): Promise<WalletChallenge> => {
  const encryptionPublicKeyResource =
    wallet.walletEncryptionKey == null
      ? undefined
      : createWalletEncryptionPublicKeySiweResource({
          address: wallet.address,
          keyPair: wallet.walletEncryptionKey
        })
  const response = await fetch(
    buildChallengeUrl({
      challengeUrl: request.challengeUrl,
      walletAddress: wallet.address,
      chainId,
      encryptionPublicKeyResource
    })
  )
  const body = (await response.json().catch(() => null)) as
    | (Partial<WalletChallenge> & { error?: string })
    | null
  if (!response.ok || body?.message == null) {
    throw new Error(
      body?.error ?? `Challenge request failed with status ${response.status}.`
    )
  }
  assertSignInDomainMatches(body.message, request.domain)

  return {
    domain: String(body.domain ?? request.domain),
    nonce: String(body.nonce ?? ''),
    message: body.message,
    expiresAt: String(body.expiresAt ?? '')
  }
}

export const downloadTextFile = ({
  filename,
  content
}: {
  filename: string
  content: string
}): void => {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const postWalletResult = (
  result:
    | PasskeyWalletConnectResult
    | PasskeyWalletSignMessageResult
    | PasskeyWalletSignInResult,
  targetOrigin: string
): void => {
  if (window.opener != null) {
    window.opener.postMessage(result, targetOrigin)
    return
  }

  if (window.parent !== window) {
    window.parent.postMessage(result, targetOrigin)
  }
}
