import { useState } from 'react'
import { useWalletApp } from './Context'
import { formatAddress } from '../helpers/wallet'
import { getWalletRuntimeConfig } from '../helpers/runtimeConfig'
import { GitHubIcon } from './Icons'

const CurrentAccountMenu = (): JSX.Element | null => {
  const {
    activeAccount,
    activeVaultId,
    switchActiveAccount,
    vaultRegistryGroups
  } = useWalletApp()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)

  if (activeAccount == null) return null

  const activeVaultGroups = vaultRegistryGroups.filter(
    group => group.id === activeVaultId
  )
  const inactiveVaultGroups = vaultRegistryGroups.filter(
    group => group.id !== activeVaultId
  )
  const orderedVaultGroups = [...activeVaultGroups, ...inactiveVaultGroups]

  return (
    <div className='account-menu-wrap'>
      <button
        type='button'
        className='account-menu-button'
        aria-expanded={isAccountMenuOpen}
        onClick={() => setIsAccountMenuOpen((value: boolean) => !value)}
      >
        <strong>{activeAccount.name}</strong>
        <small>{formatAddress(activeAccount.address)}</small>
      </button>
      {isAccountMenuOpen ? (
        <div className='account-menu'>
          <>
            <div className='account-menu-switcher'>
              {/* <span>Switch accounts</span> */}
              <div className='account-menu-account-list'>
                {orderedVaultGroups.map(vaultGroup => {
                  const isActiveVault = vaultGroup.id === activeVaultId
                  const seedIndex =
                    vaultRegistryGroups.findIndex(
                      group => group.id === vaultGroup.id
                    ) + 1

                  return (
                    <div
                      className={
                        isActiveVault
                          ? 'account-menu-seed-group'
                          : 'account-menu-seed-group account-menu-seed-group-muted'
                      }
                      key={vaultGroup.id}
                    >
                      <span className='account-menu-seed-heading'>
                        <span>
                          {`Seed ${seedIndex}`}
                          {isActiveVault && ' (Active)'}
                        </span>
                        <small>
                          {vaultGroup.accounts.length}{' '}
                          {vaultGroup.accounts.length === 1
                            ? 'address'
                            : 'addresses'}
                        </small>
                      </span>
                      <div className='account-menu-seed-accounts'>
                        {vaultGroup.accounts.map(account => {
                          const isActive =
                            account.address.toLowerCase() ===
                            activeAccount.address.toLowerCase()

                          return (
                            <button
                              type='button'
                              className={
                                isActive
                                  ? 'account-menu-account account-menu-account-active'
                                  : 'account-menu-account'
                              }
                              key={account.address}
                              onClick={() => {
                                switchActiveAccount({
                                  account,
                                  vaultId: vaultGroup.id
                                })
                                setIsAccountMenuOpen(false)
                              }}
                              disabled={isActive}
                            >
                              <strong>{account.name}</strong>
                              <small>{account.address}</small>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <a
              className='ghost-button account-menu-settings-link'
              href='/settings'
              onClick={() => setIsAccountMenuOpen(false)}
            >
              Manage accounts
            </a>
          </>
        </div>
      ) : null}
    </div>
  )
}

export const WalletTopbar = (): JSX.Element => {
  const { handleTopbarWalletAction, hasWallets, isBusy } = useWalletApp()
  const runtimeConfig = getWalletRuntimeConfig()

  return (
    <header className='topbar'>
      <div className='brand'>
        <img src={runtimeConfig.theme.logoUrl} alt='' />
        <div>
          <strong>{runtimeConfig.brandName}</strong>
          <span>{runtimeConfig.tagline}</span>
        </div>
      </div>
      <div className='topbar-actions'>
        {!hasWallets ? (
          <button
            type='button'
            className='primary-button'
            onClick={handleTopbarWalletAction}
            disabled={isBusy}
          >
            Create passkey account 🫆
          </button>
        ) : null}
        <CurrentAccountMenu />
        <a
          className='github-link'
          href={runtimeConfig.githubUrl}
          target='_blank'
          rel='noreferrer'
          aria-label='Open GitHub repository'
        >
          <GitHubIcon />
        </a>
      </div>
    </header>
  )
}
