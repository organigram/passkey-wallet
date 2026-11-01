import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import {
  derivePasskeyWalletAccount as deriveStaticPasskeyWalletAccount,
  signPersonalMessage,
  signTypedDataMessage,
  unlockBrowserPasskeyVault
} from '@organigram/passkey-wallet/browser-wallet'
import {
  decryptPayloadWithWalletEncryptionKey,
  encryptPayloadWithWalletEncryptionKey
} from '@organigram/passkey-wallet/encryption'
import {
  passkeyWalletConnectResultType,
  passkeyWalletConnectType,
  passkeyWalletSignMessageResultType,
  passkeyWalletSignMessageType,
  passkeyWalletSignTypedDataResultType,
  passkeyWalletSignTypedDataType,
  passkeyWalletSendTransactionResultType,
  passkeyWalletSendTransactionType,
  passkeyWalletEncryptPayloadResultType,
  passkeyWalletEncryptPayloadType,
  passkeyWalletDecryptPayloadResultType,
  passkeyWalletDecryptPayloadType,
  passkeyWalletRemoteErrorResultType,
  type PasskeyWalletConnectResult,
  type PasskeyWalletRemoteRequest,
  type PasskeyWalletSignMessageResult,
  type PasskeyWalletSignTypedDataResult,
  type PasskeyWalletSendTransactionResult,
  type PasskeyWalletEncryptPayloadResult,
  type PasskeyWalletDecryptPayloadResult,
  type PasskeyWalletRemoteErrorResult
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
  ensureActiveWalletConnectionRecord,
  loadWalletConnectionRecords,
  recordWalletConnectionRequest,
  removeWalletPendingConnectionRequest,
  type WalletConnectionRecord,
  type WalletPendingConnectionRequest
} from '../helpers/walletConnections'
import { getStackOrigin } from '../helpers/remote-backup'
import { getPasskeyRpId } from '../helpers/runtimeConfig'
import { sendRemoteWalletTransaction } from '../helpers/walletLocalActions'

type RequestResult =
  | PasskeyWalletSignInResult
  | PasskeyWalletSignMessageResult
  | PasskeyWalletSignTypedDataResult
  | PasskeyWalletSendTransactionResult
  | PasskeyWalletEncryptPayloadResult
  | PasskeyWalletDecryptPayloadResult

// Encrypted payload results carry a secret or its ciphertext: they are only
// delivered to the requesting app, never kept as the visible last result.
type DisplayedRequestResult = Exclude<
  RequestResult,
  PasskeyWalletEncryptPayloadResult | PasskeyWalletDecryptPayloadResult
>

type WalletApprovalResult =
  | RequestResult
  | PasskeyWalletConnectResult
  | PasskeyWalletRemoteErrorResult

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
  setLastResult: (result: DisplayedRequestResult | null) => void
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
      records,
      rpId: getPasskeyRpId()
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

  const deliverRemoteError = (
    request: PasskeyWalletRemoteRequest,
    error: unknown,
    deliverResult: DeliverWalletResult
  ): void => {
    const result: PasskeyWalletRemoteErrorResult = {
      type: passkeyWalletRemoteErrorResultType,
      version: 1,
      requestId: request.requestId,
      domain: request.domain,
      chainId: request.chainId,
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString()
    }
    deliverResult(result, request.appOrigin)
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
    const activeConnection = await ensureActiveWalletConnectionRecord({
      domain: request.domain,
      appOrigin: request.appOrigin,
      address: unlockedWallet.address,
      chainId: request.chainId,
      requestId: request.requestId,
      requestedAt: request.requestedAt
    })
    if (activeConnection == null) {
      throw new Error(
        'This wallet connection is not active. Ask the app to connect this wallet again.'
      )
    }
    setWalletConnectionRecords(loadWalletConnectionRecords())

    const walletEncryptionKey =
      request.type === passkeyWalletEncryptPayloadType ||
      request.type === passkeyWalletDecryptPayloadType
        ? unlockedWallet.walletEncryptionKey
        : null
    if (
      (request.type === passkeyWalletEncryptPayloadType ||
        request.type === passkeyWalletDecryptPayloadType) &&
      walletEncryptionKey == null
    ) {
      throw new Error('This vault does not contain a wallet encryption key.')
    }

    const result: RequestResult =
      request.type === passkeyWalletSignMessageType
        ? {
            type: passkeyWalletSignMessageResultType,
            version: 1,
            requestId: request.requestId,
            domain: request.domain,
            address: unlockedWallet.address,
            chainId: request.chainId,
            message: request.message,
            signature: await signPersonalMessage({
              wallet: unlockedWallet,
              message: request.message
            }),
            completedAt: new Date().toISOString()
          }
        : request.type === passkeyWalletSignTypedDataType ? {
            type: passkeyWalletSignTypedDataResultType,
            version: 1,
            requestId: request.requestId,
            domain: request.domain,
            address: unlockedWallet.address,
            chainId: request.chainId,
            typedData: request.typedData,
            signature: await signTypedDataMessage({
              wallet: unlockedWallet,
              typedData: request.typedData
            }),
            completedAt: new Date().toISOString()
          } : request.type === passkeyWalletEncryptPayloadType ? {
            type: passkeyWalletEncryptPayloadResultType,
            version: 1,
            requestId: request.requestId,
            domain: request.domain,
            address: unlockedWallet.address,
            chainId: request.chainId,
            encryptedPayload: await encryptPayloadWithWalletEncryptionKey({
              address: unlockedWallet.address,
              appOrigin: request.appOrigin,
              plaintext: request.plaintext,
              keyPair: walletEncryptionKey!
            }),
            completedAt: new Date().toISOString()
          } : request.type === passkeyWalletDecryptPayloadType ? {
            type: passkeyWalletDecryptPayloadResultType,
            version: 1,
            requestId: request.requestId,
            domain: request.domain,
            address: unlockedWallet.address,
            chainId: request.chainId,
            plaintext: await decryptPayloadWithWalletEncryptionKey({
              encryptedPayload: request.encryptedPayload,
              appOrigin: request.appOrigin,
              keyPair: walletEncryptionKey!
            }),
            completedAt: new Date().toISOString()
          } : {
            type: passkeyWalletSendTransactionResultType,
            version: 1,
            requestId: request.requestId,
            domain: request.domain,
            address: unlockedWallet.address,
            chainId: request.chainId,
            transactionHash: await sendRemoteWalletTransaction({
              wallet: unlockedWallet,
              transaction: request.transaction,
              walletChain,
              chainId: request.chainId,
              // The configured Stack API proxies RPC calls so the wallet never
              // needs CORS access to a chain provider (or local Anvil). It is
              // never derived from the requesting application, which could
              // otherwise choose the node that prices and relays the
              // transaction.
              walletRpcUrl: new URL(
                `/api/rpc/${request.chainId}`,
                getStackOrigin()
              ).toString()
            }),
            completedAt: new Date().toISOString()
          }
    setLastResult(
      result.type === passkeyWalletEncryptPayloadResultType ||
        result.type === passkeyWalletDecryptPayloadResultType
        ? null
        : result
    )
    setWalletPendingConnectionRequests(
      removeWalletPendingConnectionRequest({
        kind:
          request.type === passkeyWalletSignTypedDataType ? 'sign-typed-data' : request.type === passkeyWalletSendTransactionType ? 'send-transaction' : request.type === passkeyWalletEncryptPayloadType ? 'encrypt-payload' : request.type === passkeyWalletDecryptPayloadType ? 'decrypt-payload' : 'sign-message',
        requestId: request.requestId
      })
    )
    deliverResult(result, request.appOrigin)
    setPendingRequest(null)
    setStatus(request.type === passkeyWalletSendTransactionType ? `Submitted transaction for ${request.domain}.` : request.type === passkeyWalletEncryptPayloadType || request.type === passkeyWalletDecryptPayloadType ? `Completed encrypted recovery request for ${request.domain}.` : `Returned signed request to ${request.domain}.`)
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
      try {
        assertWalletRequestNotExpired(pendingRequest)
        if (pendingRequest.kind === 'remote') {
          await approveRemoteRequest(pendingRequest.request)
          return
        }

        await approveSignInRequest(pendingRequest.request)
      } catch (error) {
        if (pendingRequest.kind === 'remote') {
          deliverRemoteError(
            pendingRequest.request,
            error,
            deliverWalletResult
          )
        }
        throw error
      }
    })
  }

  const approveWalletRequest = async (
    request: PendingWalletRequest,
    deliverResult: DeliverWalletResult = deliverWalletResult
  ): Promise<void> => {
    await runAction('Signing requested challenge...', async () => {
      try {
        assertWalletRequestNotExpired(request)
        if (request.kind === 'remote') {
          await approveRemoteRequest(request.request, deliverResult)
          return
        }

        await approveSignInRequest(request.request, deliverResult)
      } catch (error) {
        if (request.kind === 'remote') {
          deliverRemoteError(request.request, error, deliverResult)
        }
        throw error
      }
    })
  }

  return {
    approveWalletRequest,
    approvePendingRequest,
    unlockWalletForRequest
  }
}
