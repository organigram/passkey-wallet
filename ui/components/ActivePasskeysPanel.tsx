import { useEffect, useState } from 'react'
import { useWalletApp } from './Context'
import { formatCredentialId, formatDate } from '../helpers/wallet'
import type { StoredVaultRecord } from '../helpers/storage'
import { PasskeyDeviceMark, getPasskeyDeviceInfo } from './PasskeyDevice'

export const ActivePasskeysPanel = (): JSX.Element | null => {
  const [isAddingPasskey, setIsAddingPasskey] = useState(false)
  const [passkeyName, setPasskeyName] = useState('Additional passkey')
  const {
    activeAccount,
    activeAccountAddress,
    addPasskeyToActiveAccount,
    isBusy,
    removeVault,
    staticCredentialIds
  } = useWalletApp()

  useEffect(() => {
    setIsAddingPasskey(false)
    setPasskeyName('Additional passkey')
  }, [activeAccountAddress])

  if (activeAccount == null) return null

  return (
    <div className='panel'>
      <div className='panel-heading'>
        <div>
          <h2>Passkeys</h2>
          <p>Passkeys that can approve sensitive actions for this seed.</p>
        </div>
      </div>
      <div className='active-passkey-list'>
        {activeAccount.passkeys.map((passkey: StoredVaultRecord) => {
          const isStatic = staticCredentialIds.has(passkey.credentialId)
          const isOnlyAccountPasskey = activeAccount.passkeys.length <= 1
          const cannotRemoveReason = isStatic
            ? 'Static vault passkeys cannot be removed here.'
            : isOnlyAccountPasskey
              ? 'Add another passkey before removing this one.'
              : undefined
          return (
            <div className='active-passkey-row' key={passkey.credentialId}>
              <div className='passkey-summary'>
                <PasskeyDeviceMark record={passkey} />
                <div className='passkey-summary-text'>
                  <strong>{passkey.name}</strong>
                  <span>
                    {getPasskeyDeviceInfo(passkey).label} ·{' '}
                    {formatCredentialId(passkey.credentialId)} ·{' '}
                    {formatDate(passkey.lastUsedAt)}
                  </span>
                </div>
              </div>
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
      {isAddingPasskey ? (
        <div className='passkey-create-form'>
          <label>
            New passkey name
            <input
              value={passkeyName}
              onChange={event => setPasskeyName(event.target.value)}
            />
          </label>
          <button
            type='button'
            className='ghost-button'
            onClick={async () => {
              await addPasskeyToActiveAccount(passkeyName)
              setPasskeyName('Additional passkey')
              setIsAddingPasskey(false)
            }}
            disabled={isBusy}
          >
            Add new passkey
          </button>
        </div>
      ) : (
        <button
          type='button'
          className='ghost-button'
          onClick={() => setIsAddingPasskey(true)}
          disabled={isBusy}
        >
          Create new passkey
        </button>
      )}
    </div>
  )
}
