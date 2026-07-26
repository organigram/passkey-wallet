import { useEffect } from 'react'
import { useWalletApp } from './Context'
import { FileEncryptionPanel } from './FileEncryptionPanel'
import { SignPanel } from './SignPanel'
import { WalletHero } from './Hero'
import { WalletPortfolioPanel } from './PortfolioPanel'
import { WalletRequestPage } from './RequestPage'
import { WalletTopbar } from './Topbar'
import { WalletSettingsView } from './Settings'
import { NetworkSettingsPanel } from './Settings/NetworkSettingsPanel'
import { TokenSettingsPanel } from './Settings/TokenSettingsPanel'
import { getWalletRuntimeConfig } from '../helpers/runtimeConfig'

const LoadingWallet = (): JSX.Element => {
  const runtimeConfig = getWalletRuntimeConfig()

  return (
    <main className='background-page'>
      <div className='background-brand'>
        <img src={runtimeConfig.theme.logoUrl} alt='' />
        <strong>{runtimeConfig.brandName}</strong>
      </div>
    </main>
  )
}

const ErrorBanner = (): JSX.Element | null => {
  const { error } = useWalletApp()

  return error == null ? null : <div className='error-banner'>{error}</div>
}

const LockedWalletPage = (): JSX.Element => (
  <main className='app-shell locked-shell'>
    <WalletTopbar />
    <div className='locked-wallet-center'>
      <WalletHero />
      <ErrorBanner />
    </div>
  </main>
)

const RedirectHome = (): JSX.Element => {
  useEffect(() => {
    window.location.replace('/')
  }, [])

  return <LoadingWallet />
}

const SettingsPage = (): JSX.Element => (
  <main className='app-shell'>
    <WalletTopbar />
    <WalletHero />
    <ErrorBanner />
    <WalletSettingsView />
  </main>
)

const LatestSignaturePanel = (): JSX.Element | null => {
  const { lastResult } = useWalletApp()

  return lastResult == null ? null : (
    <section className='result-panel'>
      <h2>Latest signature</h2>
      <dl>
        <div>
          <dt>Address</dt>
          <dd>{lastResult.address}</dd>
        </div>
        <div>
          <dt>Signature</dt>
          <dd>{lastResult.signature}</dd>
        </div>
      </dl>
    </section>
  )
}

const WalletHomePage = (): JSX.Element => (
  <main className='app-shell'>
    <WalletTopbar />
    <WalletHero />
    <ErrorBanner />

    <section className='workflow-grid'>
      <div className='main-panel-stack'>
        <WalletPortfolioPanel />
        <TokenSettingsPanel />
        <SignPanel />
      </div>
      <div className='side-panel-stack'>
        <NetworkSettingsPanel />
        <FileEncryptionPanel />
      </div>
    </section>

    <LatestSignaturePanel />
  </main>
)

export const Router = (): JSX.Element => {
  const {
    combinedVaults,
    isManagingAccounts,
    isRegistryReady,
    isRequestPage,
    isSettingsPage,
    pendingRequest
  } = useWalletApp()

  if (
    !isRegistryReady &&
    combinedVaults.length === 0 &&
    !isRequestPage &&
    !isSettingsPage
  ) {
    return <LoadingWallet />
  }

  if (isRequestPage || pendingRequest != null) {
    return <WalletRequestPage />
  }

  if (isSettingsPage && isRegistryReady && combinedVaults.length === 0) {
    return <RedirectHome />
  }

  if (isSettingsPage || isManagingAccounts) {
    return <SettingsPage />
  }

  if (combinedVaults.length === 0) {
    return <LockedWalletPage />
  }

  return <WalletHomePage />
}
