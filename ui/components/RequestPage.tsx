import { inferPasskeyRpId } from '@organigram/passkey-wallet/browser-wallet'

import { useWalletApp } from './Context'
import { getWalletRuntimeConfig } from '../helpers/runtimeConfig'
import { WalletRequestPanel } from './RequestPanel'
import { useWalletSetupPanels } from './SetupPanels'

export const WalletRequestPage = (): JSX.Element => {
  const runtimeConfig = getWalletRuntimeConfig()
  const { combinedVaults, error, pendingRequest, status } = useWalletApp()
  const { accountSetupPanel } = useWalletSetupPanels()
  const shouldShowRequestSetup =
    pendingRequest != null && combinedVaults.length === 0

  return (
    <main className='background-page'>
      <div className='background-content request-background-content'>
        <a className='request-page-link' href='/' target='_blank' rel='noopener noreferrer'>
          <div className='background-brand'>
            <img src={runtimeConfig.theme.logoUrl} alt='' />
            <strong>{runtimeConfig.brandName}</strong>
          </div>
        </a>
        <div className='request-page'>
          <div className='status-panel request-status'>
            <span>Status</span>
            <strong>{status}</strong>
            <small>RP ID: {inferPasskeyRpId() || 'not available'}</small>
          </div>

          {error != null ? <div className='error-banner'>{error}</div> : null}

          {shouldShowRequestSetup ? (
            <div className='request-floating-setup'>
              <div className='request-wallet-setup-callout'>
                <strong>Wallet account required</strong>
                <p>You need to create an account to perform this action.</p>
              </div>
              {accountSetupPanel}
            </div>
          ) : (
            <div className='panel primary-panel request-panel'>
              <div className='panel-heading'>
                <div>
                  <h1>Wallet request</h1>
                  <p>
                    {pendingRequest == null
                      ? 'No pending request is attached to this page.'
                      : `Approve the request from ${pendingRequest.request.domain}.`}
                  </p>
                </div>
              </div>
              {pendingRequest != null && <WalletRequestPanel />}
            </div>
          )}
          <a
            className='request-account-link'
            href='/settings#connections'
            target='_blank'
            rel='noopener noreferrer'
          >
            <span>Open in Passkey Wallet</span>
            <svg
              aria-hidden='true'
              className='external-link-icon'
              fill='none'
              height='14'
              viewBox='0 0 24 24'
              width='14'
            >
              <path
                d='M7 17 17 7M9 7h8v8'
                stroke='currentColor'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
              />
            </svg>
          </a>
        </div>
      </div>
    </main>
  )
}
