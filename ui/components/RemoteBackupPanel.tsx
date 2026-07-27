import { useWalletApp } from './Context'
import { openOrganigramSignIn } from '../helpers/wallet'

const backupAccessWarningMessage = [
  'Encrypted backup access warning',
  '',
  'This backup alone does not guarantee access to your funds. You need at least one active passkey to unlock the vault.',
  '',
  'If every passkey is lost, the only recovery path is a seed phrase that you already exported.'
].join('\n')

const confirmBackupAccessWarning = (): boolean =>
  window.confirm(backupAccessWarningMessage)

export const RemoteBackupPanel = (): JSX.Element => {
  const {
    activeAccount,
    activeLocalVaults,
    backupActiveAccountVaults,
    exportEncryptedBackup,
    isBusy,
    remoteBackupStatus
  } = useWalletApp()
  const requiresOrganigramSignIn =
    remoteBackupStatus.state === 'unavailable' &&
    remoteBackupStatus.label === 'Organigram sign-in required'

  return (
    <div className='panel remote-backup-panel'>
      <div className='panel-heading'>
        <div>
          <h2>Save backup</h2>
          <p>Keep the PRF-encrypted seed for this account recoverable.</p>
        </div>
      </div>
      <div
        className={`backup-status backup-status-${remoteBackupStatus.state}`}
      >
        <span>{remoteBackupStatus.label}</span>
        <p>{remoteBackupStatus.detail}</p>
      </div>
      <div className='remote-backup-actions'>
        {activeAccount == null ? null : (
          <button
            type='button'
            className='primary-button'
            onClick={() => {
              if (!confirmBackupAccessWarning()) return

              if (requiresOrganigramSignIn) {
                openOrganigramSignIn()
                return
              }

              backupActiveAccountVaults()
            }}
            disabled={
              isBusy ||
              activeLocalVaults.length === 0 ||
              remoteBackupStatus.state === 'checking' ||
              remoteBackupStatus.state === 'backed-up'
            }
          >
            {remoteBackupStatus.state === 'backed-up'
              ? 'Already backed up'
              : 'Save remote backup'}
          </button>
        )}{' '}
        <button
          type='button'
          className='ghost-button'
          onClick={() => {
            if (!confirmBackupAccessWarning()) return
            exportEncryptedBackup()
          }}
          disabled={isBusy || activeAccount == null}
        >
          Download backup
        </button>
      </div>
    </div>
  )
}
