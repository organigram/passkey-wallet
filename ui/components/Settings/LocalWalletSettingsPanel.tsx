import { useState } from 'react'
import { getWalletRuntimeConfig } from '../../helpers/runtimeConfig'
import {
  getLocalWalletHost,
  canHandOffToLocalWallet,
  isLocalWalletEnabled,
  localWalletInstructionsUrl,
  setLocalWalletEnabled
} from '../../helpers/localWallet'
import { ExternalLinkIcon } from '../Icons'

export const LocalWalletSettingsPanel = (): JSX.Element | null => {
  const [enabled, setEnabled] = useState(isLocalWalletEnabled)
  if (!canHandOffToLocalWallet()) return null

  return (
    <section className='settings-card'>
      <div className='settings-card-heading'>
        <div>
          <h2>Your own wallet</h2>
          <p>
            Run this wallet on your computer to use the same accounts without
            depending on this server.
          </p>
          <a
            className='external-text-link settings-card-link'
            href={localWalletInstructionsUrl(getWalletRuntimeConfig().githubUrl)}
            target='_blank'
            rel='noopener noreferrer'
          >
            <span>How to run it locally</span>
            <ExternalLinkIcon />
          </a>
        </div>
      </div>
      <label className='settings-switch'>
        <input
          type='checkbox'
          checked={enabled}
          onChange={event => {
            setLocalWalletEnabled(event.target.checked)
            setEnabled(event.target.checked)
          }}
        />
        <span aria-hidden='true' />
        <strong>
          Send requests to the local wallet via {getLocalWalletHost()}
        </strong>
      </label>
    </section>
  )
}
