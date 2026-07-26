import React from 'react'
import ReactDOM from 'react-dom/client'

import { loadWalletRuntimeConfig } from './helpers/runtimeConfig'
import './styles.css'

loadWalletRuntimeConfig()
  .catch(() => undefined)
  .finally(async () => {
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
