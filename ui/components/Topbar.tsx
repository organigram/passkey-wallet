import { useState } from 'react'
import { useWalletApp } from './Context'
import { formatAddress } from '../helpers/wallet'
import { getWalletRuntimeConfig } from '../helpers/runtimeConfig'
import { CheckIcon, CopyIcon, GitHubIcon } from './Icons'

const CurrentAccountMenu = (): JSX.Element | null => {
  const {
    activeAccount,
    activeVaultId,
    setStatus,
    switchActiveAccount,
    vaultRegistryGroups
  } = useWalletApp()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  if (activeAccount == null) return null

  const activeVaultGroups = vaultRegistryGroups.filter(
    group => group.id === activeVaultId
  )
  const inactiveVaultGroups = vaultRegistryGroups.filter(
    group => group.id !== activeVaultId
  )
  const orderedVaultGroups = [...activeVaultGroups, ...inactiveVaultGroups]

  const copyAddress = async (address: `0x${string}`): Promise<void> => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setStatus('Address copied.')
    } catch (clipboardError) {
      console.warn('Unable to copy address:', clipboardError)
      setStatus('Unable to copy address.')
    }
  }

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
                            <div
                              className={
                                isActive
                                  ? 'account-menu-account account-menu-account-active'
                                  : 'account-menu-account'
                              }
                              key={account.address}
                            >
                              <button
                                type='button'
                                className='account-menu-account-button'
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
                              <button
                                type='button'
                                className='account-menu-copy-button'
                                onClick={() => { copyAddress(account.address).catch(() => undefined) }}
                                aria-label={
                                  copiedAddress === account.address
                                    ? `${account.name} address copied`
                                    : `Copy ${account.name} address`
                                }
                                title={
                                  copiedAddress === account.address
                                    ? 'Address copied'
                                    : 'Copy address'
                                }
                              >
                                {copiedAddress === account.address ? (
                                  <CheckIcon />
                                ) : (
                                  <CopyIcon />
                                )}
                              </button>
                            </div>
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
