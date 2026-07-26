import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import type { Chain, Hex } from 'viem'

import type { GasPriority } from '../helpers/wallet'
import {
  sendNativeAssetTransaction,
  signManualWalletMessage
} from '../helpers/walletLocalActions'

type RunAction = (
  nextStatus: string,
  action: () => Promise<void>
) => Promise<void>

type UseWalletLocalActionsOptions = {
  unlockWalletForRequest: () => Promise<UnlockedPasskeyWallet>
  runAction: RunAction
  setBalanceRefreshKey: (updater: (value: number) => number) => void
  setLastResult: (result: any) => void
  setLastTransactionHash: (hash: Hex | null) => void
  setStatus: (status: string) => void
}

type SendNativeAssetInput = {
  destination: string
  amount: string
  data: string
  gasPriority: GasPriority
  walletChain: Chain
  walletRpcUrl: string
}

export const useWalletLocalActions = ({
  unlockWalletForRequest,
  runAction,
  setBalanceRefreshKey,
  setLastResult,
  setLastTransactionHash,
  setStatus
}: UseWalletLocalActionsOptions) => {
  const signManualMessage = async (manualMessage: string): Promise<void> => {
    await runAction('Signing local message...', async () => {
      const activeWallet = await unlockWalletForRequest()
      const result = await signManualWalletMessage({
        wallet: activeWallet,
        message: manualMessage,
        domain: window.location.host,
        requestId: `manual-${Date.now()}`,
        completedAt: new Date().toISOString()
      })
      setLastResult(result)
      setStatus('Message signed locally.')
    })
  }

  const sendNativeAsset = async ({
    destination,
    amount,
    data,
    gasPriority,
    walletChain,
    walletRpcUrl
  }: SendNativeAssetInput): Promise<void> => {
    await runAction('Sending transaction...', async () => {
      const activeWallet = await unlockWalletForRequest()
      const hash = await sendNativeAssetTransaction({
        wallet: activeWallet,
        destination,
        amount,
        data,
        gasPriority,
        walletChain,
        walletRpcUrl
      })

      setLastTransactionHash(hash)
      setBalanceRefreshKey(value => value + 1)
      setStatus(`Transaction sent: ${hash}`)
    })
  }

  return {
    sendNativeAsset,
    signManualMessage
  }
}
