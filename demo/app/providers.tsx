'use client'

import { connectorsForWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createFetchPasskeyWalletApiClient,
  exportPasskeyWalletSeedPhrase,
  registerAdditionalPasskeyCredential,
  unlockOrCreatePasskeyWallet
} from '@organigram/passkey-wallet/webauthn-client'
import { createOrganigramPasskeyWallet } from '@organigram/passkey-wallet/rainbowkit'
import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { sepolia } from 'wagmi/chains'

const api = createFetchPasskeyWalletApiClient('/api/auth/passkey')

const passkeyWallet = createOrganigramPasskeyWallet({
  unlockOrCreatePasskeyWallet: async input =>
    await unlockOrCreatePasskeyWallet({
      api,
      capabilities: input.capabilities,
      targetChainId: input.targetChainId
    }),
  registerAdditionalPasskeyCredential: async input =>
    await registerAdditionalPasskeyCredential({
      api,
      wallet: input.wallet,
      name: input.name
    }),
  exportPasskeyWalletSeedPhrase: async input =>
    await exportPasskeyWalletSeedPhrase({
      api,
      expectedAddress: input.expectedAddress
    })
})

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [() => passkeyWallet]
    }
  ],
  {
    appName: 'Organigram Passkey Wallet example',
    projectId: '00000000000000000000000000000000'
  }
)

const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http()
  },
  ssr: true
})

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
