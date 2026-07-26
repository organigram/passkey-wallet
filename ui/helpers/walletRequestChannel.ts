import type {
  PasskeyWalletConnectResult,
  PasskeyWalletSignMessageResult
} from '@organigram/passkey-wallet/remote-protocol'
import type { PasskeyWalletSignInResult } from '@organigram/passkey-wallet/sign-in-protocol'

export const walletRequestChannelName = 'organigram.passkeyWallet.requests.v1'

export type WalletRequestChannelResult =
  | PasskeyWalletConnectResult
  | PasskeyWalletSignMessageResult
  | PasskeyWalletSignInResult

export type WalletRequestChannelMessage =
  | {
      type: 'approve-request'
      requestId: string
    }
  | {
      type: 'relay-probe'
      requestId: string
    }
  | {
      type: 'relay-ready'
      requestId: string
    }
  | {
      type: 'request-result'
      requestId: string
      result: WalletRequestChannelResult
      targetOrigin: string
    }
  | {
      type: 'request-approved'
      requestId: string
    }

export const postWalletRequestChannelMessage = (
  message: WalletRequestChannelMessage
): boolean => {
  if (typeof BroadcastChannel === 'undefined') return false

  const channel = new BroadcastChannel(walletRequestChannelName)
  channel.postMessage(message)
  channel.close()
  return true
}

export const waitForWalletRequestRelay = ({
  requestId,
  timeoutMs = 1200
}: {
  requestId: string
  timeoutMs?: number
}): Promise<boolean> => {
  if (typeof BroadcastChannel === 'undefined') {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    const channel = new BroadcastChannel(walletRequestChannelName)
    const timeout = window.setTimeout(() => {
      channel.close()
      resolve(false)
    }, timeoutMs)

    channel.onmessage = (
      event: MessageEvent<WalletRequestChannelMessage>
    ): void => {
      if (
        event.data?.type !== 'relay-ready' ||
        event.data.requestId !== requestId
      ) {
        return
      }

      window.clearTimeout(timeout)
      channel.close()
      resolve(true)
    }

    channel.postMessage({
      type: 'relay-probe',
      requestId
    })
  })
}
