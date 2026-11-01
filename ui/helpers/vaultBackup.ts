import type { UnlockedPasskeyWallet } from '@organigram/passkey-wallet'
import {
  derivePasskeyWalletAccount as deriveStaticPasskeyWalletAccount,
  decryptVaultPayloadWithPrfOutput,
  requestPasskeyPrfOutput,
  unlockBrowserPasskeyVault
} from '@organigram/passkey-wallet/browser-wallet'
import { getVaultAccount } from '@organigram/passkey-wallet/vault-registry'

import { getPasskeyRpId } from './runtimeConfig'

import {
  createRemoteVaultBackupPackage,
  createRemoteVaultBackupRecord,
  decryptRemoteVaultBackupRecord,
  type RemoteVaultBackupPackage,
  type RemoteVaultBackupRecord
} from './remote-backup'
import {
  parseVaultRegistry,
  vaultHasAccount,
  type StoredVaultAccount,
  type StoredVaultRecord,
  type VaultRegistry
} from './storage'

type BackupAccount = {
  address: `0x${string}`
}

export type ActiveAccountBackupPackage = {
  backupPackage: RemoteVaultBackupPackage
  unlockedWallet: UnlockedPasskeyWallet
}

export const createActiveAccountBackupPackage = async ({
  activeAccount,
  activeLocalVaults
}: {
  activeAccount: BackupAccount | null
  activeLocalVaults: StoredVaultRecord[]
}): Promise<ActiveAccountBackupPackage> => {
  if (activeAccount == null) {
    throw new Error('Select an account before exporting encrypted backups.')
  }
  if (activeLocalVaults.length === 0) {
    throw new Error('Only browser-stored vaults can be exported.')
  }

  const unlockResult = await unlockBrowserPasskeyVault({
    records: activeLocalVaults,
    rpId: getPasskeyRpId()
  })
  const account = getVaultAccount(unlockResult.record, activeAccount.address)
  if (account == null) {
    throw new Error('Unlocked vault does not contain the active account.')
  }
  const recordsToBackUp = activeLocalVaults.filter(record =>
    vaultHasAccount(record, activeAccount.address)
  )
  if (recordsToBackUp.length === 0) {
    throw new Error('No browser-stored vault record matches the active account.')
  }
  const unlockedWallet = deriveStaticPasskeyWalletAccount({
    wallet: unlockResult.wallet,
    account
  })
  const backups = await Promise.all(
    recordsToBackUp.map(record =>
      createRemoteVaultBackupRecord({
        address: activeAccount.address,
        record,
        recoveryPhrase: unlockResult.wallet.recoveryPhrase
      })
    )
  )

  return {
    backupPackage: createRemoteVaultBackupPackage({
      address: activeAccount.address,
      backups
    }),
    unlockedWallet
  }
}

export const decryptRemoteVaultBackups = async ({
  address,
  backups
}: {
  address: `0x${string}`
  backups: RemoteVaultBackupRecord[]
}): Promise<{
  registry: VaultRegistry
  restoredAccount: StoredVaultAccount
}> => {
  // Any passkey of the wallet decrypts its own envelope, which yields the
  // recovery phrase that keys the rest of every backup.
  const { credentialId, prfOutput } = await requestPasskeyPrfOutput({
    rpId: getPasskeyRpId(),
    credentials: backups.map(backup => ({
      credentialId: backup.credentialId,
      prfSalt: backup.envelope.prfSalt
    }))
  })
  let recoveryPhrase: string | undefined
  try {
    for (const backup of backups.filter(
      candidate => candidate.credentialId === credentialId
    )) {
      try {
        recoveryPhrase = (
          await decryptVaultPayloadWithPrfOutput({
            envelope: backup.envelope,
            prfOutput
          })
        ).recoveryPhrase
        break
      } catch {
        // Try the next backup of the same passkey.
      }
    }
  } finally {
    prfOutput.fill(0)
  }
  if (recoveryPhrase == null) {
    throw new Error('Unable to decrypt any encrypted vault backup.')
  }

  const restoredVaults: StoredVaultRecord[] = []
  for (const backup of backups) {
    try {
      restoredVaults.push(
        await decryptRemoteVaultBackupRecord({
          address,
          backup,
          recoveryPhrase
        })
      )
    } catch {
      // Skip a backup that does not belong to this wallet.
    }
  }
  const registry = parseVaultRegistry({
    version: 1,
    vaults: restoredVaults
  })
  if (registry.vaults.length === 0) {
    throw new Error('Unable to decrypt any encrypted vault backup.')
  }

  const restoredAccount =
    registry.vaults
      .flatMap(vault => vault.accounts)
      .find(account => account.address.toLowerCase() === address.toLowerCase()) ??
    registry.vaults[0]?.accounts[0]
  if (restoredAccount == null) {
    throw new Error('Restored backup does not contain any wallet account.')
  }

  return {
    registry,
    restoredAccount
  }
}
