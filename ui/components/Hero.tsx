import { useWalletApp } from './Context'
import { getWalletRuntimeConfig } from '../helpers/runtimeConfig'
import { useWalletSetupPanels } from './SetupPanels'

export const WalletHero = (): JSX.Element => {
  const runtimeConfig = getWalletRuntimeConfig()
  const {
    accountSetupView,
    hasWallets,
    isManagingAccounts,
    isSettingsPage
  } = useWalletApp()
  const {
    accountSetupPanel,
    backToWalletPanel,
    emptyWalletActionsPanel
  } = useWalletSetupPanels()
  const heroAccountPanel =
    isManagingAccounts || isSettingsPage
      ? backToWalletPanel
      : accountSetupView != null
      ? accountSetupPanel
      : !hasWallets
        ? emptyWalletActionsPanel
        : null

  return (
    <section
      className={[
        'hero-band',
        !hasWallets ? 'hero-band-locked' : '',
        heroAccountPanel == null ? 'hero-band-full' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className='hero-glass-card'>
        <div>
          <h1>{runtimeConfig.title}</h1>
          <p>{runtimeConfig.subtitle}</p>
        </div>
        {heroAccountPanel}
      </div>
    </section>
  )
}
