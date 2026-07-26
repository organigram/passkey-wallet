import { getAddress } from 'viem'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'

import {
  createWalletEncryptionKeyPair,
  parseWalletEncryptionKeyPair,
  type WalletEncryptionKeyPairPayload
} from './encryption'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptPasskeyVaultSecret,
  derivePasskeyVaultKey,
  encryptPasskeyVaultSecret,
  randomBytes,
  textEncoder,
  toArrayBuffer
} from './crypto'
import type { StoredVaultAccount, StoredVaultRecord } from './localVault'
import { inferPasskeyRpId as inferRpIdFromHostname } from './rpId'
import type { UnlockedPasskeyWallet } from './types'

type PublicKeyCredentialWithPrf = PublicKeyCredential & {
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse
  getClientExtensionResults: () => {
    prf?: {
      enabled?: boolean
      results?: {
        first?: ArrayBuffer
      }
    }
  }
}

const unlockedPasskeyWalletTtlMs = 15 * 60 * 1000

export type BrowserPasskeyWalletVaultPayload = {
  version: 1
  recoveryPhrase: string
  walletEncryptionKey?: WalletEncryptionKeyPairPayload
}

const bufferSourceToBytes = (value: BufferSource): Uint8Array =>
  value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

const createChallenge = (): Uint8Array => randomBytes(32)
const getPasskeyPrfInput = (): ArrayBuffer => toArrayBuffer(new Uint8Array(32))

const createPasskeyPrfInputsByCredential = (
  records: StoredVaultRecord[]
): Record<string, { first: ArrayBuffer }> =>
  Object.fromEntries(
    records.map(record => [
      record.rawCredentialId ?? record.credentialId,
      {
        first: getPasskeyPrfInput()
      }
    ])
  )

export const createBrowserPasskeyWalletVaultPayload = async (
  recoveryPhrase: string
): Promise<BrowserPasskeyWalletVaultPayload> => {
  return {
    version: 1,
    recoveryPhrase,
    walletEncryptionKey: await createWalletEncryptionKeyPair()
  }
}

export const parseBrowserPasskeyWalletVaultPayload = (
  plaintext: string
): BrowserPasskeyWalletVaultPayload => {
  const payload = JSON.parse(
    plaintext
  ) as Partial<BrowserPasskeyWalletVaultPayload>
  if (
    payload.version !== 1 ||
    typeof payload.recoveryPhrase !== 'string' ||
    payload.recoveryPhrase.trim() === ''
  ) {
    throw new Error('Unsupported passkey wallet vault payload.')
  }

  return {
    version: 1,
    recoveryPhrase: payload.recoveryPhrase,
    ...(payload.walletEncryptionKey == null
      ? {}
      : {
          walletEncryptionKey: parseWalletEncryptionKeyPair(
            payload.walletEncryptionKey
          )
        })
  }
}

const requirePasskeyCredential = (
  credential: Credential | null
): PublicKeyCredentialWithPrf => {
  if (credential == null || credential.type !== 'public-key') {
    throw new Error('Passkey operation did not return a public key credential.')
  }

  return credential as PublicKeyCredentialWithPrf
}

const getPrfOutput = (credential: PublicKeyCredentialWithPrf): Uint8Array => {
  const first = credential.getClientExtensionResults().prf?.results?.first
  if (first == null) {
    throw new Error('This passkey did not return a PRF output.')
  }

  return bufferSourceToBytes(first)
}

const getCredentialId = (credential: PublicKeyCredential): string =>
  credential.id !== ''
    ? credential.id
    : bytesToBase64Url(bufferSourceToBytes(credential.rawId))

const getRawCredentialId = (credential: PublicKeyCredential): string =>
  bytesToBase64Url(bufferSourceToBytes(credential.rawId))

const getCredentialTransports = (
  credential: PublicKeyCredentialWithPrf
): string[] => {
  const transports =
    credential.response instanceof AuthenticatorAttestationResponse
      ? credential.response.getTransports?.()
      : undefined

  return Array.from(new Set(transports ?? [])).sort()
}

const getCurrentPasskeyDevice = (
  transports: string[]
): StoredVaultRecord['passkeyDevice'] => {
  const transportSet = new Set(transports)
  if (transportSet.has('usb') || transportSet.has('nfc') || transportSet.has('ble')) {
    return {
      kind: 'security-key',
      label: 'Security key'
    }
  }
  if (transportSet.has('hybrid') && !transportSet.has('internal')) {
    return {
      kind: 'cross-device',
      label: 'Phone passkey'
    }
  }

  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }
  const platformText = [
    nav.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/(iphone|ipod)/.test(platformText)) {
    return {
      kind: 'ios',
      label: 'iPhone passkey'
    }
  }
  if (platformText.includes('ipad')) {
    return {
      kind: 'ipados',
      label: 'iPad passkey'
    }
  }
  if (platformText.includes('mac')) {
    return {
      kind: 'macos',
      label: 'macOS passkey'
    }
  }
  if (platformText.includes('windows')) {
    return {
      kind: 'windows',
      label: 'Windows Hello'
    }
  }
  if (platformText.includes('android')) {
    return {
      kind: 'android',
      label: 'Android passkey'
    }
  }
  if (platformText.includes('linux')) {
    return {
      kind: 'linux',
      label: 'Linux passkey'
    }
  }
  if (transportSet.has('internal')) {
    return {
      kind: 'platform',
      label: 'Device passkey'
    }
  }

  return {
    kind: 'passkey',
    label: 'Passkey'
  }
}

const createPasskeyVaultRecord = async ({
  accounts,
  name,
  rpId,
  rpName,
  vaultPayload
}: {
  accounts: StoredVaultAccount[]
  name: string
  rpId: string
  rpName: string
  vaultPayload: BrowserPasskeyWalletVaultPayload
}): Promise<StoredVaultRecord> => {
  const primaryAccount = accounts[0]
  if (primaryAccount == null) {
    throw new Error('A passkey vault record requires at least one account.')
  }

  const credential = requirePasskeyCredential(
    await navigator.credentials.create({
      publicKey: {
        rp: {
          id: rpId,
          name: rpName
        },
        user: {
          id: toArrayBuffer(randomBytes(16)),
          name: primaryAccount.address,
          displayName: name.trim() || primaryAccount.address
        },
        challenge: toArrayBuffer(createChallenge()),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required'
        },
        attestation: 'none',
        timeout: 90_000,
        extensions: {
          prf: {
            eval: {
              first: getPasskeyPrfInput()
            }
          }
        } as AuthenticationExtensionsClientInputs
      }
    })
  )
  const prfOutput = getPrfOutput(credential)
  const salt = randomBytes(32)
  const key = await derivePasskeyVaultKey({
    prfOutput,
    salt
  })
  const envelope = await encryptPasskeyVaultSecret({
    plaintext: JSON.stringify(vaultPayload),
    key,
    salt
  })
  const credentialId = getCredentialId(credential)
  const rawCredentialId = getRawCredentialId(credential)
  const transports = getCredentialTransports(credential)

  return {
    version: 1,
    address: primaryAccount.address,
    accounts,
    credentialId,
    rawCredentialId,
    name: name.trim() || rpName,
    transports,
    passkeyDevice: getCurrentPasskeyDevice(transports),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    envelope
  }
}

export const inferPasskeyRpId = (
  hostname = window.location.hostname
): string => inferRpIdFromHostname(hostname)

export const createGeneratedRecoveryPhrase = (): string =>
  generateMnemonic(english, 128)

export const getDerivationPath = (addressIndex: number): string =>
  `m/44'/60'/0'/0/${addressIndex}`

export const deriveStoredVaultAccount = ({
  recoveryPhrase,
  addressIndex,
  name
}: {
  recoveryPhrase: string
  addressIndex: number
  name: string
}): StoredVaultAccount => {
  const account = mnemonicToAccount(recoveryPhrase, { addressIndex })

  return {
    address: getAddress(account.address),
    name: name.trim() || `Account ${addressIndex + 1}`,
    addressIndex,
    derivationPath: getDerivationPath(addressIndex)
  }
}

const createUnlockedWallet = ({
  vaultAccount,
  credentialId,
  vaultPayload
}: {
  vaultAccount: StoredVaultAccount
  credentialId: string
  vaultPayload: BrowserPasskeyWalletVaultPayload
}): UnlockedPasskeyWallet => {
  const account = mnemonicToAccount(vaultPayload.recoveryPhrase, {
    addressIndex: vaultAccount.addressIndex
  })

  return {
    address: vaultAccount.address,
    account,
    recoveryPhrase: vaultPayload.recoveryPhrase,
    walletEncryptionKey: vaultPayload.walletEncryptionKey,
    credentialId,
    expiresAt: Date.now() + unlockedPasskeyWalletTtlMs
  }
}

export const derivePasskeyWalletAccount = ({
  wallet,
  account
}: {
  wallet: UnlockedPasskeyWallet
  account: StoredVaultAccount
}): UnlockedPasskeyWallet => {
  const derivedAccount = mnemonicToAccount(wallet.recoveryPhrase, {
    addressIndex: account.addressIndex
  })

  if (derivedAccount.address.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error('Derived account metadata does not match the vault seed.')
  }

  return {
    ...wallet,
    address: account.address,
    account: derivedAccount
  }
}

export const registerBrowserPasskeyVault = async ({
  recoveryPhrase,
  name,
  rpId = inferPasskeyRpId(),
  rpName = 'Organigram Passkey Wallet'
}: {
  recoveryPhrase: string
  name: string
  rpId?: string
  rpName?: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
}> => {
  if (window.PublicKeyCredential == null) {
    throw new Error('Passkeys are not available in this browser.')
  }

  const normalizedRecoveryPhrase = recoveryPhrase.trim().replace(/\s+/g, ' ')
  const account = deriveStoredVaultAccount({
    recoveryPhrase: normalizedRecoveryPhrase,
    addressIndex: 0,
    name: name.trim() || 'Account 1'
  })
  const vaultPayload =
    await createBrowserPasskeyWalletVaultPayload(normalizedRecoveryPhrase)
  const record = await createPasskeyVaultRecord({
    accounts: [account],
    name: name.trim() || 'Organigram Passkey Wallet',
    rpId,
    rpName,
    vaultPayload
  })

  return {
    record,
    wallet: createUnlockedWallet({
      vaultAccount: account,
      credentialId: record.credentialId,
      vaultPayload
    })
  }
}

export const registerAdditionalBrowserPasskeyVault = async ({
  wallet,
  name,
  accounts,
  rpId = inferPasskeyRpId(),
  rpName = 'Organigram Passkey Wallet'
}: {
  wallet: UnlockedPasskeyWallet
  name: string
  accounts: StoredVaultAccount[]
  rpId?: string
  rpName?: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
}> => {
  if (window.PublicKeyCredential == null) {
    throw new Error('Passkeys are not available in this browser.')
  }

  const vaultPayload: BrowserPasskeyWalletVaultPayload = {
    version: 1,
    recoveryPhrase: wallet.recoveryPhrase,
    walletEncryptionKey: wallet.walletEncryptionKey
  }
  const record = await createPasskeyVaultRecord({
    accounts,
    name: name.trim() || 'Additional passkey',
    rpId,
    rpName,
    vaultPayload
  })

  return {
    record,
    wallet: {
      ...wallet,
      credentialId: record.credentialId,
      expiresAt: Date.now() + unlockedPasskeyWalletTtlMs
    }
  }
}

export const unlockBrowserPasskeyVault = async ({
  records,
  rpId = inferPasskeyRpId()
}: {
  records: StoredVaultRecord[]
  rpId?: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
  prfOutput: Uint8Array
}> => {
  if (records.length === 0) {
    throw new Error('No encrypted vault record is available.')
  }

  const credential = requirePasskeyCredential(
    await navigator.credentials.get({
      publicKey: {
        rpId,
        challenge: toArrayBuffer(createChallenge()),
        allowCredentials: records.map(record => ({
          type: 'public-key',
          id: toArrayBuffer(
            base64UrlToBytes(record.rawCredentialId ?? record.credentialId)
          ),
          transports: record.transports as AuthenticatorTransport[]
        })),
        userVerification: 'required',
        timeout: 90_000,
        extensions: {
          prf: {
            evalByCredential: createPasskeyPrfInputsByCredential(records)
          }
        } as AuthenticationExtensionsClientInputs
      }
    })
  )
  const selectedCredentialIds = new Set([
    getCredentialId(credential),
    getRawCredentialId(credential)
  ])
  const candidateRecords = records.filter(
    record =>
      selectedCredentialIds.has(record.credentialId) ||
      (record.rawCredentialId != null &&
        selectedCredentialIds.has(record.rawCredentialId))
  )
  const recordsToTry = candidateRecords.length > 0 ? candidateRecords : records
  const prfOutput = getPrfOutput(credential)

  for (const record of recordsToTry) {
    try {
      const key = await derivePasskeyVaultKey({
        prfOutput,
        salt: base64UrlToBytes(record.envelope.salt)
      })
      const plaintext = await decryptPasskeyVaultSecret({
        envelope: record.envelope,
        key
      })
      const vaultPayload = parseBrowserPasskeyWalletVaultPayload(plaintext)
      const wallet = createUnlockedWallet({
        vaultAccount: record.accounts[0],
        credentialId: record.credentialId,
        vaultPayload
      })
      if (
        wallet.account.address.toLowerCase() !==
        record.accounts[0].address.toLowerCase()
      ) {
        throw new Error('Encrypted vault does not match the registered address.')
      }

      return {
        record,
        wallet,
        prfOutput
      }
    } catch {
      // Try the next matching encrypted vault.
    }
  }

  throw new Error('Unable to decrypt passkey wallet.')
}

export const updateStaticPasskeyVaultEncryptionKey = async ({
  records,
  walletEncryptionKey,
  rpId = inferPasskeyRpId()
}: {
  records: StoredVaultRecord[]
  walletEncryptionKey: WalletEncryptionKeyPairPayload
  rpId?: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
}> => {
  const result = await unlockBrowserPasskeyVault({ records, rpId })
  const vaultPayload: BrowserPasskeyWalletVaultPayload = {
    version: 1,
    recoveryPhrase: result.wallet.recoveryPhrase,
    walletEncryptionKey
  }
  const salt = randomBytes(32)
  const key = await derivePasskeyVaultKey({
    prfOutput: result.prfOutput,
    salt
  })
  const envelope = await encryptPasskeyVaultSecret({
    plaintext: JSON.stringify(vaultPayload),
    key,
    salt
  })
  const record: StoredVaultRecord = {
    ...result.record,
    envelope,
    lastUsedAt: new Date().toISOString()
  }

  return {
    record,
    wallet: createUnlockedWallet({
      vaultAccount: record.accounts[0],
      credentialId: record.credentialId,
      vaultPayload
    })
  }
}

export const getDiscoverablePasskeyPrfOutput = async ({
  rpId = inferPasskeyRpId()
}: {
  rpId?: string
} = {}): Promise<Uint8Array> => {
  if (window.PublicKeyCredential == null) {
    throw new Error('Passkeys are not available in this browser.')
  }

  const credential = requirePasskeyCredential(
    await navigator.credentials.get({
      publicKey: {
        rpId,
        challenge: toArrayBuffer(createChallenge()),
        userVerification: 'required',
        timeout: 90_000,
        extensions: {
          prf: {
            eval: {
              first: getPasskeyPrfInput()
            }
          }
        } as AuthenticationExtensionsClientInputs
      }
    })
  )

  return getPrfOutput(credential)
}

export const signPersonalMessage = async ({
  wallet,
  message
}: {
  wallet: UnlockedPasskeyWallet
  message: string
}): Promise<`0x${string}`> =>
  await wallet.account.signMessage({
    message
  })

export const hexEncodeMessage = (message: string): `0x${string}` =>
  `0x${Array.from(textEncoder.encode(message))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`
