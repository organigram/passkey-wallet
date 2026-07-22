import '@rainbow-me/rainbowkit/styles.css'
import './globals.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Organigram Passkey Wallet Demo',
  description: 'Demo of the Organigram Passkey Wallet using Next, Wagmi and RainbowKit.'
}

export default function RootLayout({
  children
}: {
  children: ReactNode
}): JSX.Element {
  return (
    <html lang='en'>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
