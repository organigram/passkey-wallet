import {
  type UnlockedPasskeyWallet,
  decryptFileWithWalletEncryptionKey,
  encryptFileWithWalletEncryptionKey,
  parseWalletEncryptedFilePackage,
  parseWalletEncryptionKeyPair,
  type WalletDecryptedFile,
  type WalletEncryptedFilePackage
} from '@organigram/passkey-wallet'
import {
  createGeneratedRecoveryPhrase,
  deriveStoredVaultAccount,
  registerAdditionalBrowserPasskeyVault,
  registerBrowserPasskeyVault,
  unlockBrowserPasskeyVault,
  updateStaticPasskeyVaultEncryptionKey
} from '@organigram/passkey-wallet/browser-wallet'

import {
  addAccountToLocalVaults,
  vaultHasAccount,
  type StoredVaultAccount,
  type StoredVaultRecord
} from './storage'
import {
  defaultWalletName,
  getNextAddressIndex,
  getVaultAccount,
  type VaultRegistryGroup,
  type WalletGroup
} from './wallet'

export type RegisterWalletVaultOptions = {
  name?: string
  recoveryPhrase?: string
  requireRecoveryPhrase?: boolean
}

export const registerWalletVault = async (
  options: RegisterWalletVaultOptions = {}
): Promise<Awaited<ReturnType<typeof registerBrowserPasskeyVault>>> => {
  const phraseInput = options.recoveryPhrase ?? ''
  if (options.requireRecoveryPhrase === true && phraseInput.trim() === '') {
    throw new Error('Seed phrase is required.')
  }
  const phrase =
    phraseInput.trim() === ''
      ? createGeneratedRecoveryPhrase()
      : phraseInput.trim().replace(/\s+/g, ' ')

  return registerBrowserPasskeyVault({
    recoveryPhrase: phrase,
    name: options.name || defaultWalletName
  })
}

export const registerAdditionalPasskeyForWallet = async ({
  activeAccount,
  unlockedWallet,
  name
}: {
  activeAccount: WalletGroup | null
  unlockedWallet: UnlockedPasskeyWallet
  name: string
}): Promise<Awaited<ReturnType<typeof registerAdditionalBrowserPasskeyVault>>> => {
  if (activeAccount == null) {
    throw new Error('Select an account before adding a passkey.')
  }

  const sourceRecord = activeAccount.passkeys[0]
  if (sourceRecord == null) {
    throw new Error('No encrypted vault record matches the active account.')
  }

  return registerAdditionalBrowserPasskeyVault({
    wallet: unlockedWallet,
    name,
    accounts: sourceRecord.accounts
  })
}

export const addDerivedAccountToSeedVaults = async ({
  vaultGroup,
  vaults,
  recoveryPhrase
}: {
  vaultGroup: VaultRegistryGroup
  vaults: StoredVaultRecord[]
  recoveryPhrase: string
}): Promise<{
  account: StoredVaultAccount
  nextVaults: StoredVaultRecord[]
  updatedRecord: StoredVaultRecord | null
}> => {
  const sourceAccount = vaultGroup.accounts[0]
  if (sourceAccount == null) {
    throw new Error('Select a seed before adding a derived account.')
  }

  const localVaultsForSeed = vaults.filter(vault =>
    vaultHasAccount(vault, sourceAccount.address)
  )
  if (localVaultsForSeed.length === 0) {
    throw new Error('A browser-stored vault is required to add a derived account.')
  }

  const addressIndex = getNextAddressIndex(vaultGroup.passkeys)
  const account = deriveStoredVaultAccount({
    recoveryPhrase,
    addressIndex,
    name: `Account ${addressIndex + 1}`
  })
  const nextVaults = addAccountToLocalVaults({
    sourceAddress: sourceAccount.address,
    account
  })
  const updatedRecord =
    nextVaults.find(vault => vaultHasAccount(vault, account.address)) ?? null

  return {
    account,
    nextVaults,
    updatedRecord
  }
}

export const unlockActiveWalletAccount = async (
  activeAccount: WalletGroup | null
): Promise<
  Awaited<ReturnType<typeof unlockBrowserPasskeyVault>> & {
    account: StoredVaultAccount
  }
> => {
  if (activeAccount == null) {
    throw new Error('Select an account first.')
  }

  const result = await unlockBrowserPasskeyVault({
    records: activeAccount.passkeys
  })
  const account = getVaultAccount(result.record, activeAccount.address)
  if (account == null) {
    throw new Error('Unlocked vault does not contain the active account.')
  }

  return {
    ...result,
    account
  }
}

export const updateActiveWalletEncryptionKey = async ({
  activeAccount,
  jsonImport
}: {
  activeAccount: WalletGroup | null
  jsonImport: string
}): Promise<Awaited<ReturnType<typeof updateStaticPasskeyVaultEncryptionKey>>> => {
  if (activeAccount == null) {
    throw new Error('Select an account before importing an encryption key.')
  }
  const walletEncryptionKey = parseWalletEncryptionKeyPair(
    JSON.parse(jsonImport)
  )

  return updateStaticPasskeyVaultEncryptionKey({
    records: activeAccount.passkeys,
    walletEncryptionKey
  })
}

export const encryptFileWithActiveWalletEncryptionKey = async ({
  activeAccount,
  file,
  wallet
}: {
  activeAccount: WalletGroup | null
  file: File
  wallet: Awaited<ReturnType<typeof unlockBrowserPasskeyVault>>['wallet']
}): Promise<WalletEncryptedFilePackage> => {
  if (activeAccount == null) {
    throw new Error('Select an account before encrypting a file.')
  }
  if (wallet.walletEncryptionKey == null) {
    throw new Error('This vault does not contain a wallet encryption key.')
  }

  return encryptFileWithWalletEncryptionKey({
    address: activeAccount.address,
    file,
    keyPair: wallet.walletEncryptionKey
  })
}

export const decryptFileWithActiveWalletEncryptionKey = async ({
  activeAccount,
  jsonImport,
  wallet
}: {
  activeAccount: WalletGroup | null
  jsonImport: string
  wallet: Awaited<ReturnType<typeof unlockBrowserPasskeyVault>>['wallet']
}): Promise<WalletDecryptedFile> => {
  if (activeAccount == null) {
    throw new Error('Select an account before decrypting a file.')
  }
  const encryptedPackage = parseWalletEncryptedFilePackage(
    JSON.parse(jsonImport)
  )
  if (
    encryptedPackage.recipient.address.toLowerCase() !==
    activeAccount.address.toLowerCase()
  ) {
    throw new Error('Encrypted file was created for another account.')
  }
  if (wallet.walletEncryptionKey == null) {
    throw new Error('This vault does not contain a wallet encryption key.')
  }

  return decryptFileWithWalletEncryptionKey({
    encryptedPackage,
    keyPair: wallet.walletEncryptionKey
  })
}
