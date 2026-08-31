import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import { signPersonalMessage } from '@organigram/passkey-wallet/browser-wallet'
import type { PasskeyWalletSignInResult } from '@organigram/passkey-wallet/sign-in-protocol'
import {
  createWalletClient,
  createPublicClient,
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
import type { PasskeyWalletTransaction } from '@organigram/passkey-wallet/remote-protocol'

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

export const sendRemoteWalletTransaction = async ({
  wallet,
  transaction,
  walletChain,
  walletRpcUrl,
  chainId
}: {
  wallet: UnlockedPasskeyWallet
  transaction: PasskeyWalletTransaction
  walletChain: Chain
  walletRpcUrl: string
  chainId: number
}): Promise<Hex> => {
  if (getAddress(transaction.from) !== getAddress(wallet.address)) {
    throw new Error('The transaction account does not match the unlocked wallet.')
  }
  const transactionChain =
    walletChain.id === chainId
      ? walletChain
      : ({
          ...walletChain,
          id: chainId,
          name: `Chain ${chainId}`,
          network: `chain-${chainId}`,
          rpcUrls: { default: { http: [walletRpcUrl] } }
        } as Chain)
  const walletClient = createWalletClient({ account: wallet.account, chain: transactionChain, transport: http(walletRpcUrl) })
  const publicClient = createPublicClient({ chain: transactionChain, transport: http(walletRpcUrl) })
  const value = transaction.value == null ? 0n : BigInt(transaction.value)
  const fees = transaction.gasPrice != null
    ? { gasPrice: BigInt(transaction.gasPrice) }
    : { maxFeePerGas: transaction.maxFeePerGas == null ? undefined : BigInt(transaction.maxFeePerGas), maxPriorityFeePerGas: transaction.maxPriorityFeePerGas == null ? undefined : BigInt(transaction.maxPriorityFeePerGas) }
  const gas = transaction.gas == null
    ? await publicClient.estimateGas({ account: wallet.address, to: getAddress(transaction.to), data: transaction.data, value })
    : BigInt(transaction.gas)
  const feePerGas = transaction.gasPrice != null
    ? BigInt(transaction.gasPrice)
    : transaction.maxFeePerGas != null
      ? BigInt(transaction.maxFeePerGas)
      : await publicClient.getGasPrice()
  const balance = await publicClient.getBalance({ address: wallet.address })
  const required = value + gas * feePerGas
  if (balance < required) {
    throw new Error(`Insufficient funds: this transaction requires at least ${required.toString()} wei, but this wallet holds ${balance.toString()} wei.`)
  }
  return await walletClient.sendTransaction({
    account: wallet.account,
    chain: transactionChain,
    to: getAddress(transaction.to),
    data: transaction.data,
    value,
    gas,
    nonce: transaction.nonce == null ? undefined : Number(BigInt(transaction.nonce)),
    ...fees
  })
}
