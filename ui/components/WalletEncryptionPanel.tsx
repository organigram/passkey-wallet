import { useState } from 'react'
import { useWalletApp } from './Context'
import { downloadTextFile } from '../helpers/wallet'

export const WalletEncryptionPanel = (): JSX.Element | null => {
  const {
    activeAccount,
    exportWalletEncryptionKey,
    importWalletEncryptionKey,
    isBusy
  } = useWalletApp()
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)

  if (activeAccount == null) return null

  const downloadWalletEncryptionKey = async (): Promise<void> => {
    const key = await exportWalletEncryptionKey()
    if (key == null) return
    downloadTextFile({
      filename: `passkey-wallet-encryption-key-${activeAccount.address}.json`,
      content: `${JSON.stringify(key, null, 2)}\n`
    })
  }

  return (
    <div className='panel wallet-encryption-panel'>
      <div className='panel-heading'>
        <div>
          <h2>Encryption key</h2>
          <p>Manage the key used to encrypt or decrypt files for {activeAccount.name}.</p>
        </div>
      </div>

      <div className='wallet-encryption-actions'>
        <button
          type='button'
          className='ghost-button'
          onClick={downloadWalletEncryptionKey}
          disabled={isBusy}
        >
          Export key
        </button>
        <button
          type='button'
          className='ghost-button'
          onClick={() => setShowImport(value => !value)}
          disabled={isBusy}
        >
          Import key
        </button>
      </div>

      {showImport ? (
        <div className='wallet-encryption-import'>
          <label>
            Encryption key JSON
            <textarea
              value={importJson}
              onChange={event => setImportJson(event.target.value)}
              placeholder='Paste wallet encryption key JSON'
              rows={5}
            />
          </label>
          <button
            type='button'
            className='primary-button'
            onClick={async () => {
              await importWalletEncryptionKey(importJson)
              setImportJson('')
              setShowImport(false)
            }}
            disabled={isBusy || importJson.trim() === ''}
          >
            Save key
          </button>
        </div>
      ) : null}
    </div>
  )
}
