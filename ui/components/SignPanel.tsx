import { useState } from 'react'
import { useWalletApp } from './Context'
import { WalletRequestPanel } from './RequestPanel'

export const SignPanel = (): JSX.Element => {
  const [manualMessage, setManualMessage] = useState(
    'gm from Organigram Passkey Wallet'
  )
  const {
    activeAccount,
    isBusy,
    pendingRequest,
    signManualMessage
  } = useWalletApp()
  const pendingRequestDomain = pendingRequest?.request.domain

  return (
    <div className='panel primary-panel'>
      <div className='panel-heading'>
        <div>
          <h2>{pendingRequest == null ? 'Sign' : 'Wallet request'}</h2>
          <p>
            {pendingRequest == null
              ? `Sign a message with ${activeAccount?.name ?? 'the active account'}.`
              : `Stack asks the active account to approve a request from ${pendingRequestDomain}.`}
          </p>
        </div>
      </div>

      {pendingRequest != null ? (
        <WalletRequestPanel />
      ) : (
        <div className='manual-sign-box'>
          <textarea
            value={manualMessage}
            onChange={event => setManualMessage(event.target.value)}
            rows={4}
          />
          <button
            type='button'
            className='primary-button'
            disabled={isBusy || activeAccount == null}
            onClick={() => signManualMessage(manualMessage)}
          >
            Sign message
          </button>
        </div>
      )}
    </div>
  )
}
