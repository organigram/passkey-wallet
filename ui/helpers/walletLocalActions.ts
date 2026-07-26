import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import { signPersonalMessage } from '@organigram/passkey-wallet/browser-wallet'
import type { PasskeyWalletSignInResult } from '@organigram/passkey-wallet/sign-in-protocol'
import {
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseEther,
  type Chain,
  type Hex
} from 'viem'

import {
  gasPriorityFees,
  normalizeTransactionData,
  type GasPriority
} from './wallet'

export type SignManualWalletMessageInput = {
  wallet: UnlockedPasskeyWallet
  message: string
  domain: string
  requestId: string
  completedAt: string
}

export const signManualWalletMessage = async ({
  wallet,
  message,
  domain,
  requestId,
  completedAt
}: SignManualWalletMessageInput): Promise<PasskeyWalletSignInResult> => {
  const signature = await signPersonalMessage({
    wallet,
    message
  })

  return {
    type: 'organigram:wallet:sign-in-result',
    version: 1,
    requestId,
    domain,
    address: wallet.address,
    message,
    signature,
    completedAt
  }
}

export type SendNativeAssetTransactionInput = {
  wallet: UnlockedPasskeyWallet
  destination: string
  amount: string
  data: string
  gasPriority: GasPriority
  walletChain: Chain
  walletRpcUrl: string
}

export const sendNativeAssetTransaction = async ({
  wallet,
  destination,
  amount,
  data,
  gasPriority,
  walletChain,
  walletRpcUrl
}: SendNativeAssetTransactionInput): Promise<Hex> => {
  if (!isAddress(destination)) {
    throw new Error('Enter a valid destination address.')
  }

  const value = parseEther(amount.trim())
  if (value <= 0n) {
    throw new Error('Enter an amount greater than zero.')
  }

  const walletClient = createWalletClient({
    account: wallet.account,
    chain: walletChain,
    transport: http(walletRpcUrl || undefined)
  })

  return walletClient.sendTransaction({
    account: wallet.account,
    chain: walletChain,
    to: getAddress(destination as `0x${string}`),
    value,
    data: normalizeTransactionData(data),
    maxPriorityFeePerGas: gasPriorityFees[gasPriority]
  })
}
