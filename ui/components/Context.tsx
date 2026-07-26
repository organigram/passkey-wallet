import {
  type PasskeyWalletSignInResult
} from '@organigram/passkey-wallet/sign-in-protocol'
import {
  type PasskeyWalletSignMessageResult
} from '@organigram/passkey-wallet/remote-protocol'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useWalletLocalActions } from '../hooks/useWalletLocalActions'
import { useRemoteVaultBackup } from '../hooks/useRemoteVaultBackup'
import { useWalletRequestApproval } from '../hooks/useWalletRequestApproval'
import { useWalletPortfolio } from '../hooks/useWalletPortfolio'

import {
  type WalletEncryptionKeyPairPayload,
  type WalletEncryptedFilePackage,
  type WalletDecryptedFile
} from '@organigram/passkey-wallet'
import {
  defaultStaticVaultRegistry,
  loadLocalVaults,
  markVaultUsed,
  removeAccountFromLocalVaults,
  removeLocalVault,
  removeLocalVaults,
  saveLocalVaults,
  upsertLocalVault,
  vaultHasAccount,
  type StoredVaultAccount,
  type StoredVaultRecord
} from '../helpers/storage'
import {
  getErrorMessage,
  getStoredActiveVaultId,
  getWalletAppRouteFlags,
  parseInitialWalletLocationRequest,
  parsePendingWalletRequestFromConnectionRequest,
  saveStoredActiveVaultId
} from '../helpers/walletApp'
import {
  defaultWalletName,
  formatAddress,
  getVaultRegistryGroupId,
  groupVaultRecordsBySeed,
  groupVaultsByWallet,
  mergeVaults,
  postWalletResult,
  type AccountSetupView,
  type PendingWalletRequest,
  type VaultRegistryGroup
} from '../helpers/wallet'
import {
  loadWalletConnectionRecords,
  loadWalletPendingConnectionRequests,
  isWalletPendingConnectionRequestExpired,
  recordWalletPendingConnectionRequest,
  removeWalletPendingConnectionRequest,
  revokeActiveWalletConnectionRecord,
  revokeWalletConnectionRecordsForAppSession,
  revokeWalletConnectionRecord,
  syncWalletConnectionRecordsForAppSessions,
  walletConnectionsStorageKey,
  walletPendingConnectionsStorageKey,
  type WalletConnectionRecord,
  type WalletPendingConnectionRequest
} from '../helpers/walletConnections'
import {
  postWalletRequestChannelMessage,
  waitForWalletRequestRelay,
  walletRequestChannelName,
  type WalletRequestChannelMessage
} from '../helpers/walletRequestChannel'
import {
  passkeyWalletSessionUnavailableEvent,
  revokePasskeyWalletSession
} from '../helpers/remote-backup'
import {
  addDerivedAccountToSeedVaults,
  decryptFileWithActiveWalletEncryptionKey,
  encryptFileWithActiveWalletEncryptionKey,
  registerAdditionalPasskeyForWallet,
  registerWalletVault,
  unlockActiveWalletAccount,
  updateActiveWalletEncryptionKey
} from '../helpers/walletVaultActions'

type WalletAppState = ReturnType<typeof useWalletAppState>['core']
type WalletPortfolioState = ReturnType<typeof useWalletAppState>['portfolio']

const WalletAppContext = createContext<WalletAppState | null>(null)
const WalletPortfolioContext = createContext<WalletPortfolioState | null>(null)

const useWalletAppState = () => {
  const [vaults, setVaults] = useState<StoredVaultRecord[]>([])
  const [staticVaults, setStaticVaults] = useState<StoredVaultRecord[]>([])
  const [pendingRequest, setPendingRequest] =
    useState<PendingWalletRequest | null>(null)
  const [lastResult, setLastResult] = useState<
    PasskeyWalletSignInResult | PasskeyWalletSignMessageResult | null
  >(null)
  const [status, setStatus] = useState('Wallet ready.')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isRegistryReady, setIsRegistryReady] = useState(false)
  const [walletConnectionRecords, setWalletConnectionRecords] = useState<
    WalletConnectionRecord[]
  >(loadWalletConnectionRecords)
  const [walletPendingConnectionRequests, setWalletPendingConnectionRequests] =
    useState<WalletPendingConnectionRequest[]>(
      loadWalletPendingConnectionRequests
    )
  const [accountSetupView, setAccountSetupView] =
    useState<AccountSetupView | null>(null)
  const [activeVaultId, setActiveVaultIdState] = useState<string | null>(
    getStoredActiveVaultId
  )
  const rememberedActiveVaultIdRef = useRef<string | null>(
    getStoredActiveVaultId()
  )
  const [activeAccountAddress, setActiveAccountAddress] = useState<
    `0x${string}` | null
  >(null)
  const [isManagingAccounts, setIsManagingAccounts] = useState(false)
  const { isRequestPage, isSettingsPage } = getWalletAppRouteFlags(
    window.location.pathname
  )

  const combinedVaults = useMemo(
    () => mergeVaults(vaults, staticVaults),
    [staticVaults, vaults]
  )
  const staticCredentialIds = useMemo(
    () => new Set(staticVaults.map(staticVault => staticVault.credentialId)),
    [staticVaults]
  )
  const vaultRegistryGroups = useMemo(
    () => groupVaultRecordsBySeed(combinedVaults),
    [combinedVaults]
  )
  const activeVaultGroup = useMemo(
    () => vaultRegistryGroups.find(group => group.id === activeVaultId) ?? null,
    [activeVaultId, vaultRegistryGroups]
  )
  const walletGroups = useMemo(
    () =>
      activeVaultGroup == null
        ? []
        : groupVaultsByWallet(activeVaultGroup.passkeys),
    [activeVaultGroup]
  )
  const activeAccount = useMemo(
    () =>
      walletGroups.find(
        group =>
          activeAccountAddress != null &&
          group.address.toLowerCase() === activeAccountAddress.toLowerCase()
      ) ?? null,
    [activeAccountAddress, walletGroups]
  )
  const portfolio = useWalletPortfolio({
    activeAccountAddress,
    setError
  })
  const { setBalanceRefreshKey, setLastTransactionHash, walletChain } =
    portfolio
  const activeLocalVaults = useMemo(
    () =>
      activeAccountAddress == null
        ? []
        : vaults.filter(vault => vaultHasAccount(vault, activeAccountAddress)),
    [activeAccountAddress, vaults]
  )
  const hasWallets = combinedVaults.length > 0
  const setActiveVaultId = useCallback((vaultId: string | null): void => {
    rememberedActiveVaultIdRef.current = vaultId
    saveStoredActiveVaultId(vaultId)
    setActiveVaultIdState(vaultId)
  }, [])

  useEffect(() => {
    if (vaultRegistryGroups.length === 0) {
      setActiveVaultId(null)
      return
    }

    if (
      activeVaultId != null &&
      vaultRegistryGroups.some(group => group.id === activeVaultId)
    ) {
      return
    }

    const vaultForActiveAccount =
      activeAccountAddress == null
        ? null
        : vaultRegistryGroups.find(group =>
            group.accounts.some(
              account =>
                account.address.toLowerCase() ===
                activeAccountAddress.toLowerCase()
            )
          )
    const rememberedActiveVault = vaultRegistryGroups.find(
      group => group.id === rememberedActiveVaultIdRef.current
    )
    setActiveVaultId(
      (rememberedActiveVault ?? vaultForActiveAccount ?? vaultRegistryGroups[0])
        .id
    )
  }, [
    activeAccountAddress,
    activeVaultId,
    setActiveVaultId,
    vaultRegistryGroups
  ])

  useEffect(() => {
    if (activeVaultGroup == null) {
      setActiveAccountAddress(null)
      return
    }

    if (
      activeAccountAddress == null ||
      !activeVaultGroup.accounts.some(
        account =>
          account.address.toLowerCase() === activeAccountAddress.toLowerCase()
      )
    ) {
      setActiveAccountAddress(activeVaultGroup.accounts[0]?.address ?? null)
    }
  }, [activeAccountAddress, activeVaultGroup])

  const runAction = async (
    nextStatus: string,
    action: () => Promise<void>
  ): Promise<void> => {
    setIsBusy(true)
    setError(null)
    setStatus(nextStatus)

    try {
      await action()
    } catch (actionError) {
      setError(getErrorMessage(actionError))
    } finally {
      setIsBusy(false)
    }
  }

  const {
    backupActiveAccountVaults,
    exportEncryptedBackup,
    importEncryptedBackupJson,
    remoteBackupStatus,
    restoreEncryptedBackup
  } = useRemoteVaultBackup({
    activeAccount,
    activeLocalVaults,
    runAction,
    vaults,
    setAccountSetupView,
    setActiveAccountAddress,
    setActiveVaultId,
    setStatus,
    setVaults
  })

  const {
    approveWalletRequest,
    approvePendingRequest,
    unlockWalletForRequest
  } = useWalletRequestApproval({
    activeAccount,
    activeVaultGroup,
    combinedVaults,
    pendingRequest,
    runAction,
    walletChain,
    setActiveAccountAddress,
    setActiveVaultId,
    setLastResult,
    setPendingRequest,
    setStatus,
    setVaults,
    setWalletConnectionRecords,
    setWalletPendingConnectionRequests
  })

  const revokeWalletConnection = async (id: string): Promise<void> => {
    const record =
      walletConnectionRecords.find(connection => connection.id === id) ?? null

    await runAction('Revoking wallet connection...', async () => {
      if (
        record?.kind === 'sign-in' &&
        record.appOrigin != null &&
        record.revokedAt == null
      ) {
        await revokePasskeyWalletSession({
          address: record.address,
          origin: record.appOrigin
        })
      }

      setWalletConnectionRecords(revokeWalletConnectionRecord(id))
      setStatus('Wallet connection revoked.')
    })
  }

  const approvePendingConnectionRequest = async (
    request: WalletPendingConnectionRequest
  ): Promise<void> => {
    if (isWalletPendingConnectionRequestExpired(request)) {
      setWalletPendingConnectionRequests(
        removeWalletPendingConnectionRequest({
          kind: request.kind,
          requestId: request.requestId
        })
      )
      setError('This wallet request has expired. Please retry from the app.')
      setStatus(`Expired request from ${request.domain}.`)
      return
    }

    let walletRequest: PendingWalletRequest
    try {
      walletRequest = parsePendingWalletRequestFromConnectionRequest(
        request,
        window.location.origin
      )
    } catch (parseError) {
      setError(getErrorMessage(parseError))
      return
    }

    const relayReady = await waitForWalletRequestRelay({
      requestId: request.requestId
    })
    if (!relayReady) {
      setError(
        'Original request window is closed. Please retry the connection from the app.'
      )
      setStatus(`Unable to approve ${request.domain}.`)
      return
    }

    approveWalletRequest(walletRequest, (result, targetOrigin) => {
      const posted = postWalletRequestChannelMessage({
        type: 'request-result',
        requestId: request.requestId,
        result,
        targetOrigin
      })
      if (!posted) {
        setError(
          'Unable to return the approved request to the original wallet popup.'
        )
      }
    })
  }

  const { sendNativeAsset, signManualMessage } = useWalletLocalActions({
    unlockWalletForRequest,
    runAction,
    setBalanceRefreshKey,
    setLastResult,
    setLastTransactionHash,
    setStatus
  })

  const refreshVaults = useCallback((): void => {
    setVaults(loadLocalVaults())
  }, [])

  const refreshWalletConnections = useCallback(async (): Promise<void> => {
    const records = await syncWalletConnectionRecordsForAppSessions()
    setWalletConnectionRecords(records)
    setWalletPendingConnectionRequests(loadWalletPendingConnectionRequests())
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (
        event.key === walletConnectionsStorageKey ||
        event.key === walletPendingConnectionsStorageKey
      ) {
        refreshWalletConnections()
      }
    }
    const handleFocus = (): void => {
      refreshWalletConnections()
    }
    const handleSessionUnavailable = (event: Event): void => {
      const detail = (
        event as CustomEvent<{
          origin?: unknown
          address?: unknown
        }>
      ).detail
      if (typeof detail?.origin !== 'string') return

      setWalletConnectionRecords(
        revokeWalletConnectionRecordsForAppSession({
          appOrigin: detail.origin,
          address:
            typeof detail.address === 'string'
              ? (detail.address as `0x${string}`)
              : null
        })
      )
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleFocus)
    window.addEventListener(
      passkeyWalletSessionUnavailableEvent,
      handleSessionUnavailable
    )
    refreshWalletConnections()
    const interval = window.setInterval(() => {
      refreshWalletConnections()
    }, 15_000)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(
        passkeyWalletSessionUnavailableEvent,
        handleSessionUnavailable
      )
      window.clearInterval(interval)
    }
  }, [refreshWalletConnections])

  useEffect(() => {
    refreshVaults()
    try {
      const locationRequest = parseInitialWalletLocationRequest({
        pathname: window.location.pathname,
        search: window.location.search
      })
      if (locationRequest.kind === 'disconnect') {
        const { request } = locationRequest
        setWalletConnectionRecords(
          revokeActiveWalletConnectionRecord({
            domain: request.domain,
            appOrigin: request.appOrigin,
            address: request.address
          })
        )
        setWalletPendingConnectionRequests(
          removeWalletPendingConnectionRequest({
            kind: 'connect',
            requestId: request.requestId
          })
        )
        setPendingRequest(null)
        setStatus(locationRequest.status)
        window.setTimeout(() => {
          window.close()
        }, 250)
      } else if (locationRequest.kind === 'pending') {
        setPendingRequest(locationRequest.pendingRequest)
        setWalletPendingConnectionRequests(
          recordWalletPendingConnectionRequest(
            locationRequest.pendingConnectionRequest
          )
        )
        setStatus(locationRequest.status)
      }
    } catch (parseError) {
      setError(getErrorMessage(parseError))
    }

    setStaticVaults(defaultStaticVaultRegistry.vaults)
    setIsRegistryReady(true)
  }, [refreshVaults])

  useEffect(() => {
    if (pendingRequest == null || typeof BroadcastChannel === 'undefined') {
      return
    }

    const currentRequestId = pendingRequest.request.requestId
    const channel = new BroadcastChannel(walletRequestChannelName)
    channel.onmessage = (event: MessageEvent<WalletRequestChannelMessage>) => {
      if (
        event.data?.type === 'relay-probe' &&
        event.data.requestId === currentRequestId
      ) {
        postWalletRequestChannelMessage({
          type: 'relay-ready',
          requestId: currentRequestId
        })
        return
      }

      if (
        event.data?.type === 'request-result' &&
        event.data.requestId === currentRequestId
      ) {
        postWalletResult(event.data.result, event.data.targetOrigin)
        setPendingRequest(null)
        setStatus(
          `Returned approved request to ${pendingRequest.request.domain}.`
        )
      }
    }

    return () => {
      channel.close()
    }
  }, [pendingRequest])

  const registerWallet = async (
    options: {
      name?: string
      recoveryPhrase?: string
      requireRecoveryPhrase?: boolean
    } = {}
  ): Promise<void> => {
    await runAction('Creating encrypted passkey vault...', async () => {
      const registration = await registerWalletVault(options)
      setVaults(upsertLocalVault(registration.record))
      setActiveVaultId(getVaultRegistryGroupId(registration.record))
      setActiveAccountAddress(registration.wallet.address)
      setAccountSetupView(null)
      setStatus(`Created ${formatAddress(registration.wallet.address)}.`)
    })
  }

  const addPasskeyToActiveAccount = async (name: string): Promise<void> => {
    await runAction('Adding passkey to active account...', async () => {
      if (activeAccount == null) {
        throw new Error('Select an account before adding a passkey.')
      }

      const unlockedWallet = await unlockWalletForRequest(activeAccount.address)
      const registration = await registerAdditionalPasskeyForWallet({
        activeAccount,
        unlockedWallet,
        name,
      })
      setVaults(upsertLocalVault(registration.record))
      setActiveAccountAddress(registration.wallet.address)
      setStatus(
        `Added passkey to ${formatAddress(registration.wallet.address)}.`
      )
    })
  }

  const addDerivedAccountToVaultGroup = async (
    vaultGroup: VaultRegistryGroup
  ): Promise<void> => {
    await runAction('Adding derived account...', async () => {
      const sourceAccount = vaultGroup.accounts[0]
      if (sourceAccount == null) {
        throw new Error('Select a seed before adding a derived account.')
      }

      const unlockedWallet = await unlockWalletForRequest(sourceAccount.address)
      const { account, nextVaults, updatedRecord } =
        await addDerivedAccountToSeedVaults({
          vaultGroup,
          vaults,
          recoveryPhrase: unlockedWallet.recoveryPhrase,
        })

      setVaults(nextVaults)
      if (updatedRecord != null) {
        setActiveVaultId(getVaultRegistryGroupId(updatedRecord))
      }
      setActiveAccountAddress(account.address)
      setAccountSetupView(null)
      setStatus(`Added ${formatAddress(account.address)}.`)
    })
  }

  const addDerivedAccountToActiveVault = async (): Promise<void> => {
    if (activeVaultGroup == null) {
      await runAction('Adding derived account...', async () => {
        throw new Error('Select a seed before adding a derived account.')
      })
      return
    }

    await addDerivedAccountToVaultGroup(activeVaultGroup)
  }

  const removeVault = (credentialId: string): void => {
    if (staticCredentialIds.has(credentialId)) return

    const vaultToRemove = combinedVaults.find(
      vault => vault.credentialId === credentialId
    )
    if (vaultToRemove == null) return

    const vaultPasskeyCount = combinedVaults.filter(
      vault =>
        getVaultRegistryGroupId(vault) ===
        getVaultRegistryGroupId(vaultToRemove)
    ).length
    if (vaultPasskeyCount <= 1) {
      setError('Add another passkey before removing this one.')
      return
    }

    setVaults(removeLocalVault(credentialId))
  }

  const removeSeedVaultGroup = (vaultGroup: VaultRegistryGroup): void => {
    const localCredentialIds = new Set(
      vaultGroup.passkeys
        .filter(passkey => !staticCredentialIds.has(passkey.credentialId))
        .map(passkey => passkey.credentialId)
    )
    if (localCredentialIds.size === 0) {
      setError(
        'This seed only exists in the static registry and cannot be removed here.'
      )
      return
    }

    const confirmed = window.confirm(
      [
        'Remove this seed from this browser?',
        '',
        'This deletes every browser-stored encrypted vault record and passkey entry for this seed. Unless you have created backups, access to all the accounts derived from this seed will be lost.'
      ].join('\n')
    )
    if (!confirmed) return

    const nextVaults = removeLocalVaults(localCredentialIds)
    const nextGroups = groupVaultRecordsBySeed(
      mergeVaults(nextVaults, staticVaults)
    )
    const wasActiveSeed =
      activeVaultId === vaultGroup.id ||
      (activeAccountAddress != null &&
        vaultGroup.accounts.some(
          account =>
            account.address.toLowerCase() === activeAccountAddress.toLowerCase()
        ))
    const nextActiveGroup = nextGroups[0] ?? null

    setVaults(nextVaults)
    if (wasActiveSeed) {
      setLastResult(null)
      setActiveVaultId(nextActiveGroup?.id ?? null)
      setActiveAccountAddress(nextActiveGroup?.accounts[0]?.address ?? null)
    }
    setError(null)
    setStatus('Seed removed from this browser.')
  }

  const removeDerivedAccount = ({
    account,
    vaultGroup
  }: {
    account: StoredVaultAccount
    vaultGroup: VaultRegistryGroup
  }): void => {
    if (account.addressIndex === 0 || vaultGroup.accounts.length <= 1) {
      setError('Only derived accounts can be removed.')
      return
    }

    const nextVaults = removeAccountFromLocalVaults(account.address)
    const nextGroups = groupVaultRecordsBySeed(
      mergeVaults(nextVaults, staticVaults)
    )
    const remainingAddress = vaultGroup.accounts.find(
      candidate =>
        candidate.address.toLowerCase() !== account.address.toLowerCase()
    )?.address
    const nextActiveGroup =
      remainingAddress == null
        ? (nextGroups[0] ?? null)
        : (nextGroups.find(group =>
            group.accounts.some(
              candidate =>
                candidate.address.toLowerCase() ===
                remainingAddress.toLowerCase()
            )
          ) ??
          nextGroups[0] ??
          null)

    setVaults(nextVaults)
    if (activeAccountAddress?.toLowerCase() === account.address.toLowerCase()) {
      setLastResult(null)
      setActiveVaultId(nextActiveGroup?.id ?? null)
      setActiveAccountAddress(nextActiveGroup?.accounts[0]?.address ?? null)
    } else if (activeVaultId === vaultGroup.id && nextActiveGroup != null) {
      setActiveVaultId(nextActiveGroup.id)
    }
    setError(null)
    setStatus(`Removed ${formatAddress(account.address)}.`)
  }

  const clearLocalVaults = (): void => {
    const confirmed = window.confirm(
      [
        'Clear all browser passkeys?',
        '',
        'This removes every browser-stored encrypted vault record from this device. Remote backups and passkeys stored by the OS are not deleted.'
      ].join('\n')
    )
    if (!confirmed) return

    saveLocalVaults([])
    setVaults([])
    setLastResult(null)
    setError(null)
    setActiveVaultId(null)
    setActiveAccountAddress(null)
    setAccountSetupView(null)
    setIsManagingAccounts(false)
    setStatus('Browser passkeys cleared.')
  }

  const startImportSeedPhrase = (): void => {
    setAccountSetupView('import-seed')
  }

  const startRestoreEncryptedVault = (): void => {
    setAccountSetupView('restore')
  }

  const handleTopbarWalletAction = (): void => {
    if (!hasWallets) {
      registerWallet({ name: defaultWalletName, recoveryPhrase: '' })
    }
  }

  const switchActiveAccount = ({
    account,
    vaultId = activeVaultId
  }: {
    account: StoredVaultAccount
    vaultId?: string | null
  }): void => {
    if (vaultId != null) setActiveVaultId(vaultId)
    setActiveAccountAddress(account.address)
  }

  const exportSeedPhrase = async (): Promise<string | null> => {
    let exportedPhrase: string | null = null
    await runAction(
      'Verifying passkey before seed phrase export...',
      async () => {
        if (activeAccount == null) {
          throw new Error('Select an account before exporting its seed phrase.')
        }

        const result = await unlockActiveWalletAccount(activeAccount)
        setVaults(markVaultUsed(result.record.credentialId))
        setActiveAccountAddress(result.account.address)
        exportedPhrase = result.wallet.recoveryPhrase
        setStatus('Seed phrase exported after passkey verification.')
      }
    )
    return exportedPhrase
  }

  const unlockActiveWallet = async (): Promise<{
    record: StoredVaultRecord
    wallet: Awaited<ReturnType<typeof unlockActiveWalletAccount>>['wallet']
  }> => {
    const result = await unlockActiveWalletAccount(activeAccount)
    setVaults(markVaultUsed(result.record.credentialId))
    setActiveAccountAddress(result.account.address)
    return {
      record: result.record,
      wallet: result.wallet
    }
  }

  const exportWalletEncryptionKey =
    async (): Promise<WalletEncryptionKeyPairPayload | null> => {
      let exportedKey: WalletEncryptionKeyPairPayload | null = null
      await runAction(
        'Verifying passkey before wallet encryption key export...',
        async () => {
          const { wallet } = await unlockActiveWallet()
          if (wallet.walletEncryptionKey == null) {
            throw new Error(
              'This vault does not contain a wallet encryption key.'
            )
          }
          exportedKey = wallet.walletEncryptionKey
          setStatus(
            'Wallet encryption key exported after passkey verification.'
          )
        }
      )
      return exportedKey
    }

  const importWalletEncryptionKey = async (
    jsonImport: string
  ): Promise<void> => {
    await runAction('Importing wallet encryption key...', async () => {
      const result = await updateActiveWalletEncryptionKey({
        activeAccount,
        jsonImport
      })
      setVaults(upsertLocalVault(result.record))
      setActiveAccountAddress(result.wallet.address)
      setStatus('Wallet encryption key imported into the active vault.')
    })
  }

  const encryptFileWithActiveWalletKey = async (
    file: File
  ): Promise<WalletEncryptedFilePackage | null> => {
    let encryptedPackage: WalletEncryptedFilePackage | null = null
    await runAction('Encrypting file with wallet key...', async () => {
      const { wallet } = await unlockActiveWallet()
      encryptedPackage = await encryptFileWithActiveWalletEncryptionKey({
        activeAccount,
        file,
        wallet
      })
      setStatus(`Encrypted ${file.name}.`)
    })
    return encryptedPackage
  }

  const decryptFileWithActiveWalletKey = async (
    jsonImport: string
  ): Promise<WalletDecryptedFile | null> => {
    let decryptedFile: WalletDecryptedFile | null = null
    await runAction('Decrypting file with wallet key...', async () => {
      const { wallet } = await unlockActiveWallet()
      decryptedFile = await decryptFileWithActiveWalletEncryptionKey({
        activeAccount,
        jsonImport,
        wallet
      })
      setStatus(`Decrypted ${decryptedFile.name}.`)
    })
    return decryptedFile
  }

  return {
    core: {
      accountSetupView,
      activeAccount,
      activeAccountAddress,
      activeLocalVaults,
      activeVaultGroup,
      activeVaultId,
      addDerivedAccountToVaultGroup,
      addDerivedAccountToActiveVault,
      addPasskeyToActiveAccount,
      approvePendingConnectionRequest,
      approvePendingRequest,
      backupActiveAccountVaults,
      clearLocalVaults,
      combinedVaults,
      error,
      exportEncryptedBackup,
      exportWalletEncryptionKey,
      exportSeedPhrase,
      handleTopbarWalletAction,
      hasWallets,
      importEncryptedBackupJson,
      importWalletEncryptionKey,
      encryptFileWithActiveWalletKey,
      decryptFileWithActiveWalletKey,
      isBusy,
      isManagingAccounts,
      isRegistryReady,
      isRequestPage,
      isSettingsPage,
      lastResult,
      pendingRequest,
      registerWallet,
      remoteBackupStatus,
      removeDerivedAccount,
      removeSeedVaultGroup,
      removeVault,
      revokeWalletConnection,
      restoreEncryptedBackup,
      sendNativeAsset,
      setAccountSetupView,
      setActiveAccountAddress,
      setActiveVaultId,
      setIsManagingAccounts,
      setStatus,
      signManualMessage,
      startImportSeedPhrase,
      startRestoreEncryptedVault,
      staticCredentialIds,
      status,
      switchActiveAccount,
      vaultRegistryGroups,
      vaults,
      walletConnectionRecords,
      walletPendingConnectionRequests,
      walletGroups
    },
    portfolio
  }
}

export const WalletAppProvider = ({
  children
}: {
  children: ReactNode
}): JSX.Element => {
  const { core, portfolio } = useWalletAppState()

  return (
    <WalletAppContext.Provider value={core}>
      <WalletPortfolioContext.Provider value={portfolio}>
        {children}
      </WalletPortfolioContext.Provider>
    </WalletAppContext.Provider>
  )
}

export const useWalletApp = (): WalletAppState => {
  const context = useContext(WalletAppContext)
  if (context == null) {
    throw new Error('useWalletApp must be used inside WalletAppProvider.')
  }

  return context
}

export const useWalletPortfolioState = (): WalletPortfolioState => {
  const context = useContext(WalletPortfolioContext)
  if (context == null) {
    throw new Error(
      'useWalletPortfolioState must be used inside WalletAppProvider.'
    )
  }

  return context
}
