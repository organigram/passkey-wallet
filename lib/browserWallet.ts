import { getAddress } from 'viem'
import type { PasskeyWalletTypedData } from './remoteProtocol'
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
  toArrayBuffer,
  type PasskeyVaultEnvelopeData
} from './crypto'
import type { StoredVaultAccount, StoredVaultRecord } from './localVault'
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

  // A copy that callers own and zero once the vault key is derived.
  const prfOutput = new Uint8Array(bufferSourceToBytes(first))
  if (prfOutput.byteLength !== 32) {
    prfOutput.fill(0)
    throw new Error('This passkey returned an invalid PRF output.')
  }

  return prfOutput
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
  if (
    transportSet.has('usb') ||
    transportSet.has('nfc') ||
    transportSet.has('ble')
  ) {
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

// Zeroes the PRF output once the vault key is derived.
const encryptVaultPayloadWithPrfOutput = async ({
  prfOutput,
  prfSalt,
  vaultPayload
}: {
  prfOutput: Uint8Array
  prfSalt: Uint8Array
  vaultPayload: BrowserPasskeyWalletVaultPayload
}): Promise<PasskeyVaultEnvelopeData> => {
  try {
    const salt = randomBytes(32)
    const key = await derivePasskeyVaultKey({ prfOutput, salt })

    return await encryptPasskeyVaultSecret({
      plaintext: JSON.stringify(vaultPayload),
      key,
      salt,
      prfSalt
    })
  } finally {
    prfOutput.fill(0)
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
  const prfSalt = randomBytes(32)
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
              first: toArrayBuffer(prfSalt)
            }
          }
        } as AuthenticationExtensionsClientInputs
      }
    })
  )
  const envelope = await encryptVaultPayloadWithPrfOutput({
    prfOutput: getPrfOutput(credential),
    prfSalt,
    vaultPayload
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
    credentialId
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
  rpId = window.location.hostname,
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
  const vaultPayload = await createBrowserPasskeyWalletVaultPayload(
    normalizedRecoveryPhrase
  )
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
  rpId = window.location.hostname,
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
      credentialId: record.credentialId
    }
  }
}

export type PasskeyPrfCredential = {
  credentialId: string
  transports?: string[]
  prfSalt: string
}

/**
 * Runs one user-verified assertion restricted to the given passkeys, each
 * evaluated with its own PRF salt, and returns the PRF output of the passkey
 * the person selected. The caller owns the returned PRF output and must zero
 * it once its key is derived.
 */
export const requestPasskeyPrfOutput = async ({
  credentials,
  rpId = window.location.hostname
}: {
  credentials: PasskeyPrfCredential[]
  rpId?: string
}): Promise<{
  credentialId: string
  prfOutput: Uint8Array
}> => {
  if (window.PublicKeyCredential == null) {
    throw new Error('Passkeys are not available in this browser.')
  }
  if (credentials.length === 0) {
    throw new Error('No passkey is available for this request.')
  }

  const credential = requirePasskeyCredential(
    await navigator.credentials.get({
      publicKey: {
        rpId,
        challenge: toArrayBuffer(createChallenge()),
        allowCredentials: credentials.map(({ credentialId, transports }) => ({
          type: 'public-key',
          id: toArrayBuffer(base64UrlToBytes(credentialId)),
          transports: transports as AuthenticatorTransport[] | undefined
        })),
        userVerification: 'required',
        timeout: 90_000,
        extensions: {
          prf: {
            evalByCredential: Object.fromEntries(
              credentials.map(({ credentialId, prfSalt }) => [
                credentialId,
                { first: toArrayBuffer(base64UrlToBytes(prfSalt)) }
              ])
            )
          }
        } as AuthenticationExtensionsClientInputs
      }
    })
  )

  return {
    credentialId: getRawCredentialId(credential),
    prfOutput: getPrfOutput(credential)
  }
}

// Does not zero the PRF output: the caller may try several envelopes with it.
export const decryptVaultPayloadWithPrfOutput = async ({
  envelope,
  prfOutput
}: {
  envelope: PasskeyVaultEnvelopeData
  prfOutput: Uint8Array
}): Promise<BrowserPasskeyWalletVaultPayload> =>
  parseBrowserPasskeyWalletVaultPayload(
    await decryptPasskeyVaultSecret({
      envelope,
      key: await derivePasskeyVaultKey({
        prfOutput,
        salt: base64UrlToBytes(envelope.salt)
      })
    })
  )

const getRecordRawCredentialId = (record: StoredVaultRecord): string =>
  record.rawCredentialId ?? record.credentialId

// Returns the PRF output with the unlocked wallet; the caller must zero it.
const unlockWithPrfOutput = async ({
  records,
  rpId
}: {
  records: StoredVaultRecord[]
  rpId: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
  prfOutput: Uint8Array
}> => {
  if (records.length === 0) {
    throw new Error('No encrypted vault record is available.')
  }

  const { credentialId, prfOutput } = await requestPasskeyPrfOutput({
    rpId,
    credentials: records.map(record => ({
      credentialId: getRecordRawCredentialId(record),
      transports: record.transports,
      prfSalt: record.envelope.prfSalt
    }))
  })

  try {
    // Only the vaults of the passkey that answered can be keyed by its PRF
    // output.
    for (const record of records.filter(
      candidate => getRecordRawCredentialId(candidate) === credentialId
    )) {
      try {
        const vaultPayload = await decryptVaultPayloadWithPrfOutput({
          envelope: record.envelope,
          prfOutput
        })
        const wallet = createUnlockedWallet({
          vaultAccount: record.accounts[0],
          credentialId: record.credentialId,
          vaultPayload
        })
        if (
          wallet.account.address.toLowerCase() !==
          record.accounts[0].address.toLowerCase()
        ) {
          throw new Error(
            'Encrypted vault does not match the registered address.'
          )
        }

        return {
          record,
          wallet,
          prfOutput
        }
      } catch {
        // Try the next vault of the same passkey.
      }
    }
  } catch (error) {
    prfOutput.fill(0)
    throw error
  }

  prfOutput.fill(0)
  throw new Error('Unable to decrypt passkey wallet.')
}

export const unlockBrowserPasskeyVault = async ({
  records,
  rpId = window.location.hostname
}: {
  records: StoredVaultRecord[]
  rpId?: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
}> => {
  const { prfOutput, ...result } = await unlockWithPrfOutput({ records, rpId })
  prfOutput.fill(0)

  return result
}

export const updateStaticPasskeyVaultEncryptionKey = async ({
  records,
  walletEncryptionKey,
  rpId = window.location.hostname
}: {
  records: StoredVaultRecord[]
  walletEncryptionKey: WalletEncryptionKeyPairPayload
  rpId?: string
}): Promise<{
  record: StoredVaultRecord
  wallet: UnlockedPasskeyWallet
}> => {
  const result = await unlockWithPrfOutput({ records, rpId })
  const vaultPayload: BrowserPasskeyWalletVaultPayload = {
    version: 1,
    recoveryPhrase: result.wallet.recoveryPhrase,
    walletEncryptionKey
  }
  // The PRF output was evaluated with this vault's PRF salt, so the salt is
  // kept for the re-encrypted vault.
  const envelope = await encryptVaultPayloadWithPrfOutput({
    prfOutput: result.prfOutput,
    prfSalt: base64UrlToBytes(result.record.envelope.prfSalt),
    vaultPayload
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

export const signTypedDataMessage = async ({
  wallet,
  typedData
}: {
  wallet: UnlockedPasskeyWallet
  typedData: PasskeyWalletTypedData
}): Promise<`0x${string}`> =>
  await wallet.account.signTypedData(
    typedData as Parameters<typeof wallet.account.signTypedData>[0]
  )

export const hexEncodeMessage = (message: string): `0x${string}` =>
  `0x${Array.from(textEncoder.encode(message))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`
