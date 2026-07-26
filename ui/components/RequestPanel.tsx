import {
  passkeyWalletConnectType,
  passkeyWalletSignMessageType
} from '@organigram/passkey-wallet/remote-protocol'
import { useState } from 'react'
import { useWalletApp } from './Context'

import { formatAddress, formatDate } from '../helpers/wallet'

export const WalletRequestPanel = (): JSX.Element | null => {
  const [isRequestAccountSelectorOpen, setIsRequestAccountSelectorOpen] =
    useState(false)
  const {
    activeAccountAddress,
    approvePendingRequest,
    combinedVaults,
    isBusy,
    pendingRequest,
    switchActiveAccount,
    vaultRegistryGroups
  } = useWalletApp()
  const pendingRequestRequiredAddress =
    pendingRequest?.kind === 'remote' &&
    pendingRequest.request.type === passkeyWalletSignMessageType
      ? pendingRequest.request.address
      : null
  const requestAccountSelector =
    vaultRegistryGroups.length === 0 ? null : (
      <div className='request-account-selector'>
        <dt>Selected account</dt>
        <div className='request-account-summary'>
          <div className='request-account-callout'>
            <span>{activeAccountAddress ?? 'No account selected'}</span>
          </div>
          <button
            type='button'
            className='ghost-button'
            onClick={() =>
              setIsRequestAccountSelectorOpen((value: boolean) => !value)
            }
            disabled={isBusy}
          >
            Switch
          </button>
        </div>
        {isRequestAccountSelectorOpen ? (
          <div className='request-account-list'>
            {vaultRegistryGroups.map((vaultGroup, vaultIndex) => (
              <div className='request-vault-group' key={vaultGroup.id}>
                <strong>Seed {vaultIndex + 1}</strong>
                {vaultGroup.accounts.map(account => {
                  const isActive =
                    activeAccountAddress?.toLowerCase() ===
                    account.address.toLowerCase()
                  const isAddressMismatch =
                    pendingRequestRequiredAddress != null &&
                    account.address.toLowerCase() !==
                      pendingRequestRequiredAddress.toLowerCase()

                  return (
                    <button
                      type='button'
                      className={
                        isActive
                          ? 'request-account-option request-account-option-active'
                          : 'request-account-option'
                      }
                      key={account.address}
                      onClick={() => {
                        switchActiveAccount({
                          account,
                          vaultId: vaultGroup.id
                        })
                        setIsRequestAccountSelectorOpen(false)
                      }}
                      disabled={isActive || isAddressMismatch || isBusy}
                      title={
                        isAddressMismatch
                          ? 'This request targets another account.'
                          : undefined
                      }
                    >
                      <span>{account.name}</span>
                      <div className='flex'>
                        {isActive && (
                          <span className='state selected'>Selected</span>
                        )}
                        <small>{formatAddress(account.address)}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  const pendingRequestContent =
    pendingRequest != null ? (
      <div className='request-box'>
        {pendingRequest.kind === 'sign-in' ? (
          <dl>
            <div>
              <dt>Domain</dt>
              <dd>{pendingRequest.request.domain}</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>{formatDate(pendingRequest.request.requestedAt)}</dd>
            </div>
            <div>
              <dt>Challenge</dt>
              <dd>{new URL(pendingRequest.request.challengeUrl).origin}</dd>
            </div>
          </dl>
        ) : (
          <dl className='request-detail-grid'>
            <div className='request-detail-column'>
              <div>
                <dt>Domain</dt>
                <dd>{pendingRequest.request.domain}</dd>
              </div>
              <div>
                <dt>Requested</dt>
                <dd>{formatDate(pendingRequest.request.requestedAt)}</dd>
              </div>
            </div>
            <div className='request-detail-column'>
              <div>
                <dt>Request</dt>
                <dd>
                  {pendingRequest.request.type === passkeyWalletConnectType
                    ? 'Connect wallet'
                    : 'Sign message'}
                </dd>
              </div>
              <div>
                <dt>Chain</dt>
                <dd>{pendingRequest.request.chainId}</dd>
              </div>
              {pendingRequestRequiredAddress != null ? (
                <div>
                  <dt>Account</dt>
                  <dd>{pendingRequestRequiredAddress}</dd>
                </div>
              ) : null}
            </div>
            {pendingRequest.request.type === passkeyWalletSignMessageType
              ? (() => {
                  const message = pendingRequest.request.message
                  return (
                    <div className='request-message-detail'>
                      <dt>Message</dt>
                      <dd className='request-message-body'>
                        <pre>{message}</pre>
                      </dd>
                    </div>
                  )
                })()
              : null}
          </dl>
        )}
        {requestAccountSelector}
        <button
          type='button'
          className='primary-button'
          onClick={() => approvePendingRequest()}
          disabled={isBusy || combinedVaults.length === 0}
        >
          Approve request
        </button>
      </div>
    ) : null

  return pendingRequestContent
}
