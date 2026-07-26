import { signPersonalMessage } from '@organigram/passkey-wallet/browser-wallet'
import { useEffect, useState } from 'react'

import {
  createVaultBackupDigest,
  createVaultBackupSignatureMessage,
  fetchRemoteVaultBackups,
  normalizeBackupAddress,
  parseRemoteVaultBackupPackage,
  passkeyWalletSessionUnavailableEvent,
  RemoteVaultBackupError,
  storeRemoteVaultBackups,
  getStackOrigin,
  type RemoteVaultBackupRecord
} from '../helpers/remote-backup'
import {
  downloadTextFile,
  getVaultRegistryGroupId,
  mergeVaults,
  type AccountSetupView,
  type RemoteBackupStatus,
  type WalletGroup
} from '../helpers/wallet'
import {
  saveLocalVaults,
  type StoredVaultRecord
} from '../helpers/storage'
import {
  createActiveAccountBackupPackage,
  decryptRemoteVaultBackups
} from '../helpers/vaultBackup'

type RunAction = (
  nextStatus: string,
  action: () => Promise<void>
) => Promise<void>

type UseRemoteVaultBackupOptions = {
  activeAccount: WalletGroup | null
  activeLocalVaults: StoredVaultRecord[]
  runAction: RunAction
  vaults: StoredVaultRecord[]
  setAccountSetupView: (view: AccountSetupView | null) => void
  setActiveAccountAddress: (address: `0x${string}` | null) => void
  setActiveVaultId: (vaultId: string | null) => void
  setStatus: (status: string) => void
  setVaults: (vaults: StoredVaultRecord[]) => void
}

export const useRemoteVaultBackup = ({
  activeAccount,
  activeLocalVaults,
  runAction,
  vaults,
  setAccountSetupView,
  setActiveAccountAddress,
  setActiveVaultId,
  setStatus,
  setVaults
}: UseRemoteVaultBackupOptions) => {
  const [remoteBackupStatus, setRemoteBackupStatus] =
    useState<RemoteBackupStatus>({
      state: 'idle',
      label: 'Backup not checked',
      detail: 'Select an account to check its encrypted remote backup.'
    })
  const [backupStatusRefreshKey, setBackupStatusRefreshKey] = useState(0)

  useEffect(() => {
    const refreshBackupStatus = (): void => {
      setBackupStatusRefreshKey(value => value + 1)
    }
    const interval = window.setInterval(refreshBackupStatus, 30_000)

    window.addEventListener('focus', refreshBackupStatus)
    document.addEventListener('visibilitychange', refreshBackupStatus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshBackupStatus)
      document.removeEventListener('visibilitychange', refreshBackupStatus)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const checkBackup = async (): Promise<void> => {
      if (activeAccount == null) {
        setRemoteBackupStatus({
          state: 'idle',
          label: 'Backup not checked',
          detail: 'Select an account to check its encrypted remote backup.'
        })
        return
      }

      if (activeLocalVaults.length === 0) {
        setRemoteBackupStatus({
          state: 'idle',
          label: 'No browser vault to back up',
          detail:
            'This account has no browser-stored encrypted vault record available for remote backup.'
        })
        return
      }

      setRemoteBackupStatus({
        state: 'checking',
        label: 'Checking backup',
        detail: 'Comparing local encrypted vault records with Organigram.'
      })

      try {
        const remoteResponse = await fetchRemoteVaultBackups(
          activeAccount.address
        )
        if (cancelled) return

        if (remoteResponse.backups.length === 0) {
          setRemoteBackupStatus({
            state: 'missing',
            label: 'Backup needed',
            detail: 'No encrypted backup was found for this account.'
          })
          return
        }

        if (remoteResponse.backups.length < activeLocalVaults.length) {
          setRemoteBackupStatus({
            state: 'outdated',
            label: 'Backup update needed',
            detail: `${remoteResponse.backups.length}/${activeLocalVaults.length} encrypted vault record(s) are backed up.`
          })
          return
        }

        setRemoteBackupStatus({
          state: 'backed-up',
          label: 'Backed up',
          detail:
            remoteResponse.updatedAt == null
              ? 'An encrypted backup exists for this address.'
              : `Last updated ${new Date(remoteResponse.updatedAt).toLocaleString()}.`
        })
      } catch (backupError) {
        if (cancelled) return
        const needsOrganigramSession =
          backupError instanceof RemoteVaultBackupError &&
          backupError.status === 401
        if (needsOrganigramSession) {
          window.dispatchEvent(
            new CustomEvent(passkeyWalletSessionUnavailableEvent, {
              detail: {
                origin: getStackOrigin(),
                address: activeAccount.address
              }
            })
          )
        }
        setRemoteBackupStatus({
          state: 'unavailable',
          label: needsOrganigramSession
            ? 'Organigram sign-in required'
            : 'Backup status unavailable',
          detail:
            backupError instanceof Error
              ? backupError.message
              : String(backupError)
        })
      }
    }

    checkBackup()

    return () => {
      cancelled = true
    }
  }, [activeAccount, activeLocalVaults, backupStatusRefreshKey])

  const exportEncryptedBackup = async (): Promise<void> => {
    await runAction('Exporting encrypted backup...', async () => {
      const { backupPackage } = await createActiveAccountBackupPackage({
        activeAccount,
        activeLocalVaults
      })
      downloadTextFile({
        filename: `passkey-wallet-backup-${backupPackage.address}.json`,
        content: `${JSON.stringify(backupPackage, null, 2)}\n`
      })
      setStatus(`Exported ${backupPackage.backups.length} encrypted backup(s).`)
    })
  }

  const restoreVaultBackupPackage = async ({
    address,
    backups,
    sourceLabel
  }: {
    address: `0x${string}`
    backups: RemoteVaultBackupRecord[]
    sourceLabel: string
  }): Promise<void> => {
    const { registry, restoredAccount } = await decryptRemoteVaultBackups({
      address,
      backups
    })
    const nextVaults = mergeVaults(vaults, registry.vaults)
    saveLocalVaults(nextVaults)
    setVaults(nextVaults)
    setActiveVaultId(getVaultRegistryGroupId(registry.vaults[0]))
    setActiveAccountAddress(restoredAccount.address)
    setAccountSetupView(null)
    setStatus(
      `Restored ${registry.vaults.length} encrypted vault record(s) from ${sourceLabel}.`
    )
  }

  const importEncryptedBackupJson = async (
    jsonImport: string
  ): Promise<void> => {
    await runAction('Importing encrypted backup JSON...', async () => {
      const backupPackage = parseRemoteVaultBackupPackage(
        JSON.parse(jsonImport)
      )
      await restoreVaultBackupPackage({
        address: backupPackage.address,
        backups: backupPackage.backups,
        sourceLabel: 'local backup'
      })
    })
  }

  const backupActiveAccountVaults = async (): Promise<void> => {
    await runAction(
      'Backing up encrypted vaults to Organigram...',
      async () => {
        if (activeAccount == null) {
          throw new Error('Select an account before backing up vaults.')
        }
        if (activeLocalVaults.length === 0) {
          throw new Error(
            'Only browser-stored vaults can be backed up remotely.'
          )
        }

        const { backupPackage, unlockedWallet } =
          await createActiveAccountBackupPackage({
            activeAccount,
            activeLocalVaults
          })

        const digest = await createVaultBackupDigest(backupPackage.backups)
        const message = createVaultBackupSignatureMessage({
          address: backupPackage.address,
          vaultCount: backupPackage.backups.length,
          digest
        })
        const signature = await signPersonalMessage({
          wallet: unlockedWallet,
          message
        })
        const response = await storeRemoteVaultBackups({
          address: backupPackage.address,
          backups: backupPackage.backups,
          message,
          signature
        })
        setRemoteBackupStatus({
          state: 'backed-up',
          label: 'Backed up',
          detail: `Backed up ${response.count} encrypted record(s).`
        })
        setStatus(`Backed up ${response.count} encrypted record(s).`)
      }
    )
  }

  const restoreRemoteVaults = async (
    remoteRestoreAddress: string
  ): Promise<void> => {
    await runAction(
      'Restoring encrypted vaults from Organigram...',
      async () => {
        const address = normalizeBackupAddress(remoteRestoreAddress)
        const response = await fetchRemoteVaultBackups(address)
        if (response.backups.length === 0) {
          throw new Error(
            'No remote encrypted vault backup was found for this address.'
          )
        }
        await restoreVaultBackupPackage({
          address,
          backups: response.backups,
          sourceLabel: 'Organigram'
        })
      }
    )
  }

  const restoreEncryptedBackup = async ({
    jsonImport,
    remoteRestoreAddress
  }: {
    jsonImport: string
    remoteRestoreAddress: string
  }): Promise<void> => {
    if (jsonImport.trim() !== '') {
      await importEncryptedBackupJson(jsonImport)
      return
    }

    await restoreRemoteVaults(remoteRestoreAddress)
  }

  return {
    backupActiveAccountVaults,
    exportEncryptedBackup,
    importEncryptedBackupJson,
    remoteBackupStatus,
    restoreEncryptedBackup
  }
}
