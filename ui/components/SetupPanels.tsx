import { useState, type ReactNode } from 'react'
import { useWalletApp } from './Context'

import { defaultWalletName } from '../helpers/wallet'

export const useWalletSetupPanels = (
  callbacks: {
    closeAccountMenu?: () => void
    closeAddAccountMenu?: () => void
    closeOnPanelBack?: boolean
    showDerivedAccountAction?: boolean
  } = {}
): {
  accountSetupPanel: ReactNode
  backToWalletPanel: ReactNode
  emptyWalletActionsPanel: ReactNode
  navAccountSetupActions: ReactNode
} => {
  const [walletName, setWalletName] = useState(defaultWalletName)
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [jsonImport, setJsonImport] = useState('')
  const [remoteRestoreAddress, setRemoteRestoreAddress] = useState('')
  const options = useWalletApp()
  const {
    accountSetupView,
    activeAccount,
    activeLocalVaults,
    addDerivedAccountToActiveVault,
    hasWallets,
    isBusy,
    registerWallet,
    restoreEncryptedBackup,
    setAccountSetupView,
    startImportSeedPhrase,
    startRestoreEncryptedVault
  } = options
  const closeAddAccountMenu = callbacks.closeAddAccountMenu ?? (() => undefined)
  const closeAccountMenu = callbacks.closeAccountMenu ?? (() => undefined)
  const closeOnPanelBack = callbacks.closeOnPanelBack ?? true
  const showDerivedAccountAction = callbacks.showDerivedAccountAction ?? true

  const accountSetupPanelBackButton = (
    <button
      type='button'
      className='text-button'
      onClick={() => {
        setAccountSetupView(null)
        if (hasWallets && closeOnPanelBack) closeAddAccountMenu()
      }}
      disabled={isBusy}
    >
      Back
    </button>
  )
  const accountSetupChoiceBackButton = (
    <button
      type='button'
      className='text-button'
      onClick={() => {
        setAccountSetupView(null)
        if (hasWallets) closeAddAccountMenu()
      }}
      disabled={isBusy}
    >
      Back
    </button>
  )

  const importSeedPanel = (
    <div className='panel account-setup-panel'>
      <div className='panel-heading'>
        <div>
          <h2>Import seed phrase</h2>
          <p>
            Encrypt the seed phrase of an existing account into a new passkey
            vault.
          </p>
        </div>
      </div>
      <label>
        Wallet name
        <input
          value={walletName}
          onChange={event => setWalletName(event.target.value)}
        />
      </label>
      <label>
        Seed phrase
        <textarea
          value={recoveryPhrase}
          onChange={event => setRecoveryPhrase(event.target.value)}
          rows={4}
          placeholder='Enter your seed phrase'
        />
      </label>
      <div className='account-setup-panel-actions'>
        <button
          type='button'
          className='primary-button'
          onClick={() =>
            registerWallet({
              name: walletName,
              recoveryPhrase,
              requireRecoveryPhrase: true
            })
          }
          disabled={isBusy}
        >
          Import existing account
        </button>
        {accountSetupPanelBackButton}
      </div>
    </div>
  )
  const restoreVaultPanel = (
    <div className='panel account-setup-panel'>
      <div className='panel-heading'>
        <div>
          <h2>Restore backup</h2>
          <p>
            Recover encrypted vault records from a local backup file or from
            Organigram servers.
          </p>
        </div>
      </div>
      <label>
        Encrypted backup JSON
        <textarea
          value={jsonImport}
          onChange={event => setJsonImport(event.target.value)}
          rows={5}
          placeholder='Paste Organigram encrypted backup JSON'
        />
      </label>
      <label>
        Account address for remote restore
        <input
          value={remoteRestoreAddress}
          onChange={event => setRemoteRestoreAddress(event.target.value)}
          placeholder='0x...'
        />
      </label>
      <div className='account-setup-panel-actions'>
        <button
          type='button'
          className='primary-button'
          onClick={() =>
            restoreEncryptedBackup({ jsonImport, remoteRestoreAddress })
          }
          disabled={
            isBusy ||
            (jsonImport.trim() === '' && remoteRestoreAddress.trim() === '')
          }
        >
          Restore backup
        </button>
        {accountSetupPanelBackButton}
      </div>
    </div>
  )
  const accountSetupActions = (
    <div className='account-setup-actions'>
      <button
        type='button'
        className={hasWallets ? 'ghost-button' : 'primary-button'}
        onClick={() =>
          registerWallet({ name: defaultWalletName, recoveryPhrase: '' })
        }
        disabled={isBusy}
      >
        Create passkey account 🫆
      </button>
      <button
        type='button'
        className='ghost-button'
        onClick={startImportSeedPhrase}
      >
        Import seed phrase
      </button>
      <button
        type='button'
        className='ghost-button'
        onClick={startRestoreEncryptedVault}
      >
        Restore backup
      </button>
    </div>
  )
  const navAccountSetupActions = (
    <div className='account-menu-add-actions'>
      {showDerivedAccountAction && activeAccount != null ? (
        <button
          type='button'
          className='primary-button'
          onClick={() => {
            closeAccountMenu()
            addDerivedAccountToActiveVault()
          }}
          disabled={isBusy || activeLocalVaults.length === 0}
        >
          Add derived account
        </button>
      ) : null}
      <button
        type='button'
        className='ghost-button'
        onClick={() => {
          closeAccountMenu()
          registerWallet({ name: defaultWalletName, recoveryPhrase: '' })
        }}
        disabled={isBusy}
      >
        Create new seed phrase
      </button>
      <button
        type='button'
        className='ghost-button'
        onClick={() => {
          closeAccountMenu()
          startImportSeedPhrase()
        }}
        disabled={isBusy}
      >
        Import seed phrase
      </button>
      <button
        type='button'
        className='ghost-button'
        onClick={() => {
          closeAccountMenu()
          startRestoreEncryptedVault()
        }}
        disabled={isBusy}
      >
        Restore backup
      </button>
      <button
        type='button'
        className='text-button'
        onClick={closeAddAccountMenu}
        disabled={isBusy}
      >
        Back
      </button>
    </div>
  )
  const emptyWalletActionsPanel = (
    <div className='hero-action-panel hero-empty-actions-panel'>
      {accountSetupActions}
    </div>
  )
  const backToWalletPanel = (
    <a href='/'>
      <button className='ghost-button locked-unlock-button'>
        Back to wallet
      </button>
    </a>
  )
  const accountSetupPanel =
    accountSetupView === 'import-seed' ? (
      importSeedPanel
    ) : accountSetupView === 'restore' ? (
      restoreVaultPanel
    ) : (
      <div className='panel account-setup-panel'>
        <div className='panel-heading'>
          <div>
            <h2>Add seed phrase</h2>
            <p>Choose how to add a seed to this wallet.</p>
          </div>
        </div>
        {accountSetupActions}
        {hasWallets ? accountSetupChoiceBackButton : null}
      </div>
    )

  return {
    accountSetupPanel,
    backToWalletPanel,
    emptyWalletActionsPanel,
    navAccountSetupActions
  }
}
