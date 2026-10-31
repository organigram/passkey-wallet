import React from 'react'
import ReactDOM from 'react-dom/client'

import { announceRequestPage } from './helpers/localWallet'
import { loadWalletRuntimeConfig } from './helpers/runtimeConfig'
import './styles.css'

loadWalletRuntimeConfig()
  .catch(() => undefined)
  .finally(async () => {
    // A request handed to the local copy loads no wallet code here.
    if (announceRequestPage()) return

    const [{ WalletAppProvider }, { Router }] = await Promise.all([
      import('./components/Context'),
      import('./components/Layout')
    ])

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <WalletAppProvider>
          <Router />
        </WalletAppProvider>
      </React.StrictMode>
    )
  })
