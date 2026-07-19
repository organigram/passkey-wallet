import type { Wallet, WalletDetailsParams } from '@rainbow-me/rainbowkit'
import { getAddress } from 'viem'
import type { Chain } from 'viem'
import { createConnector } from 'wagmi'

import {
  createPasskeyWalletProvider,
  type OrganigramPasskeyProvider,
  type OrganigramPasskeyProviderActions
} from './eip1193'
import {
  organigramPasskeyWalletIcon,
  organigramPasskeyWalletId,
  type OrganigramPasskeyCapabilities,
  type UnlockedPasskeyWallet
} from './types'

export { organigramPasskeyWalletIcon, organigramPasskeyWalletId } from './types'

const walletName = 'Passkey Wallet'

const passkeyConnectorIds = new Set([organigramPasskeyWalletId])

export const isOrganigramPasskeyConnector = ({ id }: { id: string }): boolean =>
  passkeyConnectorIds.has(id)

export type CreateOrganigramPasskeyWalletInput =
  OrganigramPasskeyProviderActions & {
    unlockOrCreatePasskeyWallet: (input: {
      capabilities: OrganigramPasskeyCapabilities
      targetChainId: number
    }) => Promise<UnlockedPasskeyWallet>
  }

export const createOrganigramPasskeyWallet = ({
  unlockOrCreatePasskeyWallet,
  registerAdditionalPasskeyCredential,
  exportPasskeyWalletRecoveryPhrase
}: CreateOrganigramPasskeyWalletInput): Wallet => ({
  id: organigramPasskeyWalletId,
  name: walletName,
  shortName: 'Passkey',
  rdns: 'ai.organigram.passkey',
  iconUrl: organigramPasskeyWalletIcon,
  iconAccent: '#00C2A8',
  iconBackground: '#18272B',
  installed: true,
  createConnector: (walletDetails: WalletDetailsParams) =>
    createConnector(config => {
      let provider: OrganigramPasskeyProvider | null = null
      let wallet: UnlockedPasskeyWallet | null = null
      let activeChain = config.chains[0]

      const resolveChain = (chainId?: number): Chain => {
        const chain =
          chainId == null
            ? activeChain
            : config.chains.find(candidate => candidate.id === chainId)
        if (chain == null) {
          throw new Error('Unsupported network for Passkey Wallet.')
        }

        return chain
      }

      const getRpcUrl = (chain: Chain): string =>
        chain.rpcUrls.default.http[0] ?? chain.rpcUrls.public?.http[0] ?? ''

      return {
        ...walletDetails,
        id: organigramPasskeyWalletId,
        name: walletName,
        type: 'passkey-wallet',
        async connect(parameters): Promise<any> {
          activeChain = resolveChain(parameters?.chainId)
          const unlockedWallet = await unlockOrCreatePasskeyWallet({
            capabilities:
              (parameters as { capabilities?: OrganigramPasskeyCapabilities })
                ?.capabilities ?? {},
            targetChainId: activeChain.id
          })
          wallet = {
            ...unlockedWallet,
            address: getAddress(unlockedWallet.address)
          }
          provider = createPasskeyWalletProvider({
            wallet,
            chain: activeChain,
            rpcUrl: getRpcUrl(activeChain),
            switchChain: chainId => {
              activeChain = resolveChain(chainId)
              config.emitter.emit('change', {
                chainId: activeChain.id
              })
              return activeChain
            },
            actions: {
              registerAdditionalPasskeyCredential,
              exportPasskeyWalletRecoveryPhrase
            }
          })
          config.emitter.emit('connect', {
            accounts: [wallet.address],
            chainId: activeChain.id
          })

          if (parameters?.withCapabilities === true) {
            return {
              accounts: [
                {
                  address: wallet.address,
                  capabilities: {}
                }
              ],
              chainId: activeChain.id
            }
          }

          return {
            accounts: [wallet.address],
            chainId: activeChain.id
          }
        },
        async disconnect() {
          wallet = null
          provider = null
          config.emitter.emit('disconnect')
        },
        async getAccounts() {
          return wallet == null ? [] : [wallet.address]
        },
        async getChainId() {
          return activeChain.id
        },
        async getProvider() {
          if (provider == null) {
            throw new Error('Passkey Wallet is locked.')
          }

          return provider
        },
        async isAuthorized() {
          return wallet != null && wallet.expiresAt > Date.now()
        },
        async switchChain({ chainId }) {
          activeChain = resolveChain(chainId)
          config.emitter.emit('change', {
            chainId
          })
          return activeChain
        },
        onAccountsChanged(accounts) {
          config.emitter.emit('change', {
            accounts: accounts.map(account =>
              getAddress(account as `0x${string}`)
            )
          })
        },
        onChainChanged(chainId) {
          config.emitter.emit('change', {
            chainId: Number.parseInt(chainId, 16)
          })
        },
        onDisconnect() {
          wallet = null
          provider = null
          config.emitter.emit('disconnect')
        }
      }
    })
})
