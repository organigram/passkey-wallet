import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import {
  derivePasskeyWalletAccount as deriveStaticPasskeyWalletAccount,
  signPersonalMessage,
  unlockBrowserPasskeyVault
} from '@organigram/passkey-wallet/browser-wallet'
import {
  passkeyWalletConnectResultType,
  passkeyWalletConnectType,
  passkeyWalletSignMessageResultType,
  type PasskeyWalletConnectResult,
  type PasskeyWalletRemoteRequest,
  type PasskeyWalletSignMessageResult
} from '@organigram/passkey-wallet/remote-protocol'
import {
  type PasskeyWalletSignInRequest,
  type PasskeyWalletSignInResult
} from '@organigram/passkey-wallet/sign-in-protocol'
import type { Chain } from 'viem'
import { parseSiweMessage } from 'viem/siwe'

import {
  fetchWalletChallenge,
  formatAddress,
  getVaultAccount,
  getVaultRegistryGroupId,
  postWalletResult,
  type PendingWalletRequest,
  type VaultRegistryGroup,
  type WalletGroup
} from '../helpers/wallet'
import {
  markVaultUsed,
  vaultHasAccount,
  type StoredVaultRecord
} from '../helpers/storage'
import {
  assertWalletRequestNotExpired,
  getActiveWalletConnectionRecord,
  recordWalletConnectionRequest,
  removeWalletPendingConnectionRequest,
  type WalletConnectionRecord,
  type WalletPendingConnectionRequest
} from '../helpers/walletConnections'

type RequestResult =
  | PasskeyWalletSignInResult
  | PasskeyWalletSignMessageResult

type WalletApprovalResult = RequestResult | PasskeyWalletConnectResult

type DeliverWalletResult = (
  result: WalletApprovalResult,
  targetOrigin: string
) => void

type RunAction = (
  nextStatus: string,
  action: () => Promise<void>
) => Promise<void>

type UseWalletRequestApprovalOptions = {
  activeAccount: WalletGroup | null
  activeVaultGroup: VaultRegistryGroup | null
  combinedVaults: StoredVaultRecord[]
  pendingRequest: PendingWalletRequest | null
  runAction: RunAction
  walletChain: Chain
  setActiveAccountAddress: (address: `0x${string}` | null) => void
  setActiveVaultId: (vaultId: string | null) => void
  setLastResult: (result: RequestResult | null) => void
  setPendingRequest: (request: PendingWalletRequest | null) => void
  setStatus: (status: string) => void
  setVaults: (vaults: StoredVaultRecord[]) => void
  setWalletConnectionRecords: (records: WalletConnectionRecord[]) => void
  setWalletPendingConnectionRequests: (
    requests: WalletPendingConnectionRequest[]
  ) => void
}

export const useWalletRequestApproval = ({
  activeAccount,
  activeVaultGroup,
  combinedVaults,
  pendingRequest,
  runAction,
  walletChain,
  setActiveAccountAddress,
  setActiveVaultId,
  setLastResult,
  setPendingRequest,
  setStatus,
  setVaults,
  setWalletConnectionRecords,
  setWalletPendingConnectionRequests
}: UseWalletRequestApprovalOptions) => {
  const unlockWalletForRequest = async (
    expectedAddress?: `0x${string}`
  ): Promise<UnlockedPasskeyWallet> => {
    const requestedAddress = expectedAddress ?? activeAccount?.address
    const records =
      requestedAddress == null
        ? (activeVaultGroup?.passkeys ?? combinedVaults)
        : combinedVaults.filter(vault =>
            vaultHasAccount(vault, requestedAddress)
          )
    if (records.length === 0) {
      throw new Error(
        'No encrypted vault record matches the requested address.'
      )
    }
    const result = await unlockBrowserPasskeyVault({
      records
    })
    const account =
      requestedAddress == null
        ? result.record.accounts[0]
        : getVaultAccount(result.record, requestedAddress)
    if (account == null) {
      throw new Error('Unlocked vault does not contain the requested address.')
    }
    const unlockedWallet = deriveStaticPasskeyWalletAccount({
      wallet: result.wallet,
      account
    })
    if (
      expectedAddress != null &&
      unlockedWallet.address.toLowerCase() !== expectedAddress.toLowerCase()
    ) {
      throw new Error('Unlocked wallet does not match the requested address.')
    }

    setVaults(markVaultUsed(result.record.credentialId))
    setActiveVaultId(getVaultRegistryGroupId(result.record))
    setActiveAccountAddress(unlockedWallet.address)
    return unlockedWallet
  }

  const deliverWalletResult: DeliverWalletResult = (result, targetOrigin) => {
    postWalletResult(result, targetOrigin)
  }

  const approveRemoteRequest = async (
    request: PasskeyWalletRemoteRequest,
    deliverResult: DeliverWalletResult = deliverWalletResult
  ): Promise<void> => {
    if (request.type === passkeyWalletConnectType) {
      const unlockedWallet = await unlockWalletForRequest()
      const result: PasskeyWalletConnectResult = {
        type: passkeyWalletConnectResultType,
        version: 1,
        requestId: request.requestId,
        domain: request.domain,
        address: unlockedWallet.address,
        chainId: request.chainId,
        completedAt: new Date().toISOString()
      }
      setWalletConnectionRecords(
        recordWalletConnectionRequest({
          kind: 'connect',
          requestId: request.requestId,
          domain: request.domain,
          appOrigin: request.appOrigin,
          address: unlockedWallet.address,
          chainId: request.chainId,
          requestedAt: request.requestedAt,
          completedAt: result.completedAt
        })
      )
      setWalletPendingConnectionRequests(
        removeWalletPendingConnectionRequest({
          kind: 'connect',
          requestId: request.requestId
        })
      )
      deliverResult(result, request.appOrigin)
      setPendingRequest(null)
      setStatus(
        `Connected ${formatAddress(unlockedWallet.address)} to ${request.domain}.`
      )
      return
    }

    const unlockedWallet = await unlockWalletForRequest(request.address)
    const activeConnection = getActiveWalletConnectionRecord({
      domain: request.domain,
      appOrigin: request.appOrigin,
      address: unlockedWallet.address,
      chainId: request.chainId
    })
    if (activeConnection == null) {
      throw new Error(
        'This wallet connection is not active. Ask the app to connect this wallet again.'
      )
    }

    const signature = await signPersonalMessage({
      wallet: unlockedWallet,
      message: request.message
    })
    const result: PasskeyWalletSignMessageResult = {
      type: passkeyWalletSignMessageResultType,
      version: 1,
      requestId: request.requestId,
      domain: request.domain,
      address: unlockedWallet.address,
      chainId: request.chainId,
      message: request.message,
      signature,
      completedAt: new Date().toISOString()
    }
    setLastResult(result)
    setWalletPendingConnectionRequests(
      removeWalletPendingConnectionRequest({
        kind: 'sign-message',
        requestId: request.requestId
      })
    )
    deliverResult(result, request.appOrigin)
    setPendingRequest(null)
    setStatus(`Returned signed message to ${request.domain}.`)
  }

  const approveSignInRequest = async (
    signInRequest: PasskeyWalletSignInRequest,
    deliverResult: DeliverWalletResult = deliverWalletResult
  ): Promise<void> => {
    const unlockedWallet = await unlockWalletForRequest()
    const challenge = await fetchWalletChallenge({
      request: signInRequest,
      wallet: unlockedWallet,
      chainId: walletChain.id
    })
    const signature = await signPersonalMessage({
      wallet: unlockedWallet,
      message: challenge.message
    })
    const signedChainId = parseSiweMessage(challenge.message).chainId
    const connectionChainId =
      typeof signedChainId === 'number' ? signedChainId : walletChain.id
    const result: PasskeyWalletSignInResult = {
      type: 'organigram:wallet:sign-in-result',
      version: 1,
      requestId: signInRequest.requestId,
      domain: signInRequest.domain,
      address: unlockedWallet.address,
      message: challenge.message,
      signature,
      completedAt: new Date().toISOString()
    }
    setLastResult(result)
    setWalletConnectionRecords(
      recordWalletConnectionRequest({
        kind: 'sign-in',
        requestId: signInRequest.requestId,
        domain: signInRequest.domain,
        appOrigin: new URL(signInRequest.challengeUrl).origin,
        address: unlockedWallet.address,
        chainId: connectionChainId,
        requestedAt: signInRequest.requestedAt,
        completedAt: result.completedAt
      })
    )
    setWalletPendingConnectionRequests(
      removeWalletPendingConnectionRequest({
        kind: 'sign-in',
        requestId: signInRequest.requestId
      })
    )
    deliverResult(result, new URL(signInRequest.challengeUrl).origin)
    setPendingRequest(null)
    setStatus(`Returned signed challenge to ${signInRequest.domain}.`)
  }

  const approvePendingRequest = async (): Promise<void> => {
    if (pendingRequest == null) return

    await runAction('Signing requested challenge...', async () => {
      assertWalletRequestNotExpired(pendingRequest)
      if (pendingRequest.kind === 'remote') {
        await approveRemoteRequest(pendingRequest.request)
        return
      }

      await approveSignInRequest(pendingRequest.request)
    })
  }

  const approveWalletRequest = async (
    request: PendingWalletRequest,
    deliverResult: DeliverWalletResult = deliverWalletResult
  ): Promise<void> => {
    await runAction('Signing requested challenge...', async () => {
      assertWalletRequestNotExpired(request)
      if (request.kind === 'remote') {
        await approveRemoteRequest(request.request, deliverResult)
        return
      }

      await approveSignInRequest(request.request, deliverResult)
    })
  }

  return {
    approveWalletRequest,
    approvePendingRequest,
    unlockWalletForRequest
  }
}
