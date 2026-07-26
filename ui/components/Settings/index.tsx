import { useEffect, type ReactNode } from 'react'
import { ActivePasskeysPanel } from '../ActivePasskeysPanel'
import { RemoteBackupPanel } from '../RemoteBackupPanel'
import { SeedExportPanel } from '../SeedExportPanel'
import { WalletEncryptionPanel } from '../WalletEncryptionPanel'
import { AccountsSettingsPanel } from './AccountsSettingsPanel'
import { ConnectionsSettingsPanel } from './ConnectionsSettingsPanel'
import { CurrencySettingsPanel } from './CurrencySettingsPanel'

const SettingsAnchor = ({
  children,
  id
}: {
  children: ReactNode
  id: string
}): JSX.Element => (
  <div className='settings-anchor' id={id}>
    {children}
  </div>
)

export const WalletSettingsView = (): JSX.Element => {
  useEffect(() => {
    const scrollToHash = (): void => {
      const hash = window.location.hash.slice(1)
      if (hash === '') return

      document.getElementById(hash)?.scrollIntoView({
        block: 'start'
      })
    }

    window.setTimeout(scrollToHash, 0)
    window.addEventListener('hashchange', scrollToHash)

    return () => {
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [])

  return (
    <section className='settings-section'>
      <div className='settings-heading'>
        <div>
          <h2>Settings</h2>
        </div>
      </div>
      <div className='settings-grid'>
        <div className='settings-main-column'>
          <SettingsAnchor id='accounts'>
            <AccountsSettingsPanel />
          </SettingsAnchor>
          <SettingsAnchor id='connections'>
            <ConnectionsSettingsPanel />
          </SettingsAnchor>
          <div className='settings-anchor' id='currency'>
            <span className='settings-anchor-alias' id='currencies' />
            <CurrencySettingsPanel />
          </div>
        </div>
        <div className='settings-side-column'>
          <SettingsAnchor id='passkeys'>
            <ActivePasskeysPanel />
          </SettingsAnchor>
          <SettingsAnchor id='seed'>
            <SeedExportPanel />
          </SettingsAnchor>
          <SettingsAnchor id='encryption'>
            <WalletEncryptionPanel />
          </SettingsAnchor>
          <SettingsAnchor id='backup'>
            <RemoteBackupPanel />
          </SettingsAnchor>
        </div>
      </div>
    </section>
  )
}
