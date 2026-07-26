import { useEffect, useRef, useState } from 'react'
import { PasskeyDeviceMark, getPasskeyDeviceInfo } from '../PasskeyDevice'
import { useWalletApp } from '../Context'
import { formatCredentialId, formatDate } from '../../helpers/wallet'
import { useWalletSetupPanels } from '../SetupPanels'

export const AccountsSettingsPanel = (): JSX.Element => {
  const [isAddingSeedPhrase, setIsAddingSeedPhrase] = useState(false)
  const {
    activeAccountAddress,
    accountSetupView,
    addDerivedAccountToVaultGroup,
    clearLocalVaults,
    isBusy,
    removeDerivedAccount,
    removeSeedVaultGroup,
    removeVault,
    setAccountSetupView,
    staticCredentialIds,
    vaultRegistryGroups,
    vaults
  } = useWalletApp()
  const { accountSetupPanel } = useWalletSetupPanels({
    closeOnPanelBack: false,
    closeAddAccountMenu: () => setIsAddingSeedPhrase(false),
    showDerivedAccountAction: false
  })
  const didChooseSetupView = useRef(false)
  const initialVaultCount = useRef(vaults.length)

  useEffect(() => {
    if (!isAddingSeedPhrase) {
      didChooseSetupView.current = false
      initialVaultCount.current = vaults.length
      return
    }

    if (accountSetupView == null) {
      if (
        didChooseSetupView.current &&
        vaults.length > initialVaultCount.current
      ) {
        setIsAddingSeedPhrase(false)
        didChooseSetupView.current = false
        initialVaultCount.current = vaults.length
      }
      return
    }

    didChooseSetupView.current = true
  }, [accountSetupView, isAddingSeedPhrase, vaults.length])

  return (
    <section className='registry-section'>
      <div className='registry-heading'>
        <div>
          <h2>Accounts</h2>
          <p>
            Accounts grouped by seed phrases. Each seed can derive several
            addresses.
          </p>
        </div>
        <div className='registry-actions'>
          <button
            type='button'
            className='danger-button'
            onClick={clearLocalVaults}
            disabled={vaults.length === 0}
          >
            Clear browser passkeys
          </button>
        </div>
      </div>

      <div className='wallet-list'>
        {vaultRegistryGroups.map((vaultGroup, vaultIndex) => {
          const isActiveVault =
            activeAccountAddress != null &&
            vaultGroup.accounts.some(
              account =>
                account.address.toLowerCase() ===
                activeAccountAddress.toLowerCase()
            )
          const canAddAccount = vaultGroup.passkeys.some(
            passkey => !staticCredentialIds.has(passkey.credentialId)
          )

          return (
            <section
              className={
                isActiveVault
                  ? 'wallet-group wallet-group-active'
                  : 'wallet-group'
              }
              key={vaultGroup.id}
            >
              <div className='wallet-group-heading'>
                <div>
                  <h3>Seed {vaultIndex + 1}</h3>
                </div>
                <div className='wallet-group-actions'>
                  <span>
                    {vaultGroup.accounts.length}{' '}
                    {vaultGroup.accounts.length === 1 ? 'account' : 'accounts'}
                  </span>
                  <span>
                    {vaultGroup.passkeys.length}{' '}
                    {vaultGroup.passkeys.length === 1 ? 'passkey' : 'passkeys'}
                  </span>
                  <button
                    type='button'
                    className='ghost-button'
                    onClick={() => addDerivedAccountToVaultGroup(vaultGroup)}
                    disabled={isBusy || !canAddAccount}
                    title={
                      canAddAccount
                        ? undefined
                        : 'A browser-stored vault is required to add an account.'
                    }
                  >
                    Add account
                  </button>
                  <button
                    type='button'
                    className='danger-button'
                    onClick={() => removeSeedVaultGroup(vaultGroup)}
                    disabled={isBusy}
                  >
                    Remove seed
                  </button>
                </div>
              </div>

              <div className='vault-account-list'>
                {vaultGroup.accounts.map(account => {
                  const isActive =
                    activeAccountAddress?.toLowerCase() ===
                    account.address.toLowerCase()

                  return (
                    <div
                      className={
                        isActive
                          ? 'vault-account-row vault-account-row-active'
                          : 'vault-account-row'
                      }
                      key={account.address}
                    >
                      <div>
                        <strong>{account.name}</strong>
                        <small>{account.address}</small>
                      </div>
                      <div className='vault-account-actions'>
                        {account.addressIndex === 0 ? null : (
                          <button
                            type='button'
                            className='text-button'
                            onClick={() =>
                              removeDerivedAccount({ account, vaultGroup })
                            }
                            disabled={isBusy}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className='passkey-table'>
                <div className='passkey-row passkey-row-head'>
                  <span>Passkey</span>
                  <span>Credential</span>
                  <span>Last used</span>
                  <span>Source</span>
                  <span />
                </div>
                {vaultGroup.passkeys.map(passkey => {
                  const isStatic = staticCredentialIds.has(passkey.credentialId)
                  const isOnlyVaultPasskey = vaultGroup.passkeys.length <= 1
                  const cannotRemoveReason = isStatic
                    ? 'Static vault passkeys cannot be removed here.'
                    : isOnlyVaultPasskey
                      ? 'Add another passkey before removing this one.'
                      : undefined
                  return (
                    <div className='passkey-row' key={passkey.credentialId}>
                      <span className='passkey-summary passkey-table-summary'>
                        <PasskeyDeviceMark record={passkey} />
                        <span className='passkey-summary-text'>
                          <strong>{passkey.name}</strong>
                          <span>{getPasskeyDeviceInfo(passkey).label}</span>
                        </span>
                      </span>
                      <span>{formatCredentialId(passkey.credentialId)}</span>
                      <span>{formatDate(passkey.lastUsedAt)}</span>
                      <span>{isStatic ? 'static' : 'browser'}</span>
                      <button
                        type='button'
                        className='text-button'
                        onClick={() => removeVault(passkey.credentialId)}
                        disabled={cannotRemoveReason != null}
                        title={cannotRemoveReason}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
        {vaultRegistryGroups.length === 0 ? (
          <div className='empty-row'>No account yet.</div>
        ) : null}
      </div>
      {isAddingSeedPhrase ? null : (
        <button
          type='button'
          className='ghost-button settings-add-seed-button'
          onClick={() => {
            initialVaultCount.current = vaults.length
            setAccountSetupView(null)
            setIsAddingSeedPhrase(true)
          }}
          disabled={isBusy}
        >
          Add seed
        </button>
      )}
      {isAddingSeedPhrase ? (
        <div className='modal-backdrop' role='presentation'>
          <div
            className='wallet-action-modal account-setup-modal'
            role='dialog'
            aria-modal='true'
            aria-label='Add seed phrase'
          >
            <div className='account-setup-modal-content'>
              {accountSetupPanel}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
