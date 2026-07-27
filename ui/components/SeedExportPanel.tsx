import { useState } from 'react'
import { useWalletApp } from './Context'
import { SeedPhraseWords } from './SeedPhraseWords'

export const SeedExportPanel = (): JSX.Element | null => {
  const [exportedSeedPhrase, setExportedSeedPhrase] = useState<string | null>(
    null
  )
  const { activeAccount, exportSeedPhrase, isBusy, setStatus } = useWalletApp()

  if (activeAccount == null) return null

  return (
    <div className='panel seed-export-panel'>
      <div className='panel-heading'>
        <div>
          <h2>Seed phrase</h2>
          <p>Reveal the active account seed phrase.</p>
        </div>
      </div>
      <button
        type='button'
        className='ghost-button'
        onClick={async () => {
          setExportedSeedPhrase(await exportSeedPhrase())
        }}
        disabled={isBusy}
      >
        Reveal seed phrase
      </button>
      {exportedSeedPhrase != null ? (
        <div className='seed-phrase-box'>
          <div className='seed-phrase-heading'>
            <strong>Seed phrase</strong>
            <div className='seed-phrase-actions'>
              <button
                type='button'
                className='text-button'
                onClick={async () => {
                  if (exportedSeedPhrase == null) return
                  await navigator.clipboard.writeText(exportedSeedPhrase)
                  setStatus('Seed phrase copied.')
                }}
                disabled={isBusy}
              >
                Copy text
              </button>
              <button
                type='button'
                className='text-button'
                onClick={() => setExportedSeedPhrase(null)}
                disabled={isBusy}
              >
                Hide
              </button>
            </div>
          </div>
          <SeedPhraseWords phrase={exportedSeedPhrase} />
        </div>
      ) : null}
    </div>
  )
}
