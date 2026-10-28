import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { createHmac, randomBytes as nodeRandomBytes } from 'node:crypto'

import {
  registerAdditionalBrowserPasskeyVault,
  registerBrowserPasskeyVault,
  unlockBrowserPasskeyVault
} from './browserWallet'
import { base64UrlToBytes, bytesToBase64Url } from './crypto'

const rpId = 'wallet.example'
const recoveryPhrase =
  'test test test test test test test test test test test junk'
const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

type PrfInputs = { first: BufferSource }
type RecordedRequest = {
  rpId?: string
  rp?: { id?: string }
  allowCredentials?: Array<{ id: BufferSource }>
  userVerification?: string
  authenticatorSelection?: { userVerification?: string; residentKey?: string }
  extensions?: {
    prf?: { eval?: PrfInputs; evalByCredential?: Record<string, PrfInputs> }
  }
}

const toBytes = (value: BufferSource): Uint8Array =>
  value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

class AuthenticatorAttestationResponseStub {
  getTransports = (): string[] => ['internal']
}

// Simulates a PRF-capable platform authenticator: each passkey keeps a secret,
// and its PRF output is HMAC-SHA-256(secret, salt), stable for a given salt.
class FakeAuthenticator {
  private readonly secrets = new Map<string, Buffer>()
  readonly creations: RecordedRequest[] = []
  readonly assertions: RecordedRequest[] = []
  answerWith: string | null = null
  prfOutputLength = 32

  private credential(
    credentialId: string,
    salt: BufferSource,
    response: object
  ): object {
    const secret = this.secrets.get(credentialId) ?? nodeRandomBytes(32)
    const prfOutput = createHmac('sha256', secret)
      .update(toBytes(salt))
      .digest()
      .subarray(0, this.prfOutputLength)
    return {
      type: 'public-key',
      id: credentialId,
      rawId: base64UrlToBytes(credentialId).slice().buffer,
      response,
      getClientExtensionResults: () => ({
        prf: { enabled: true, results: { first: new Uint8Array(prfOutput).buffer } }
      })
    }
  }

  create = async ({
    publicKey
  }: {
    publicKey: RecordedRequest
  }): Promise<object> => {
    this.creations.push(publicKey)
    const credentialId = bytesToBase64Url(nodeRandomBytes(16))
    this.secrets.set(credentialId, nodeRandomBytes(32))
    return this.credential(
      credentialId,
      publicKey.extensions!.prf!.eval!.first,
      new AuthenticatorAttestationResponseStub()
    )
  }

  get = async ({ publicKey }: { publicKey: RecordedRequest }): Promise<object> => {
    this.assertions.push(publicKey)
    const credentialId =
      this.answerWith ??
      bytesToBase64Url(toBytes(publicKey.allowCredentials![0].id))
    const salt =
      publicKey.extensions?.prf?.evalByCredential?.[credentialId]?.first ??
      new Uint8Array(32)
    return this.credential(credentialId, salt, {})
  }
}

describe('browser passkey vaults', () => {
  let authenticator: FakeAuthenticator
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  )

  beforeEach(() => {
    authenticator = new FakeAuthenticator()
    Object.assign(globalThis, {
      window: globalThis,
      PublicKeyCredential: class {},
      AuthenticatorAttestationResponse: AuthenticatorAttestationResponseStub
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        platform: 'MacIntel',
        userAgent: 'jest',
        credentials: { create: authenticator.create, get: authenticator.get }
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalNavigator != null) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator)
    }
  })

  const register = async () =>
    await registerBrowserPasskeyVault({ recoveryPhrase, name: 'E2E', rpId })

  it('creates each vault with its own random PRF salt', async () => {
    const first = await register()
    const second = await register()

    for (const [index, { record }] of [first, second].entries()) {
      const creation = authenticator.creations[index]
      expect(creation.rp?.id).toBe(rpId)
      expect(creation.authenticatorSelection).toMatchObject({
        residentKey: 'required',
        userVerification: 'required'
      })
      expect(
        bytesToBase64Url(toBytes(creation.extensions!.prf!.eval!.first))
      ).toBe(record.envelope.prfSalt)
      expect(base64UrlToBytes(record.envelope.prfSalt)).toHaveLength(32)
    }
    expect(first.record.envelope.prfSalt).not.toBe(second.record.envelope.prfSalt)
    expect(first.record.address).toBe(address)
  })

  it('unlocks with one assertion evaluating each passkey with its vault salt', async () => {
    const { record: firstRecord, wallet } = await register()
    const { record: secondRecord } = await registerAdditionalBrowserPasskeyVault({
      wallet,
      name: 'Backup',
      accounts: firstRecord.accounts,
      rpId
    })
    const records = [firstRecord, secondRecord]
    authenticator.answerWith = secondRecord.credentialId

    const unlocked = await unlockBrowserPasskeyVault({ records, rpId })

    expect(authenticator.assertions).toHaveLength(1)
    const [assertion] = authenticator.assertions
    expect(assertion.rpId).toBe(rpId)
    expect(assertion.userVerification).toBe('required')
    expect(
      assertion.allowCredentials!.map(({ id }) => bytesToBase64Url(toBytes(id)))
    ).toEqual(records.map(record => record.credentialId))
    expect(
      Object.fromEntries(
        Object.entries(assertion.extensions!.prf!.evalByCredential!).map(
          ([credentialId, { first }]) => [
            credentialId,
            bytesToBase64Url(toBytes(first))
          ]
        )
      )
    ).toEqual(
      Object.fromEntries(
        records.map(record => [record.credentialId, record.envelope.prfSalt])
      )
    )
    expect(unlocked.record.credentialId).toBe(secondRecord.credentialId)
    expect(unlocked.wallet.address).toBe(address)
  })

  it('refuses a passkey that matches none of the vaults', async () => {
    const { record } = await register()
    authenticator.answerWith = bytesToBase64Url(nodeRandomBytes(16))

    await expect(
      unlockBrowserPasskeyVault({ records: [record], rpId })
    ).rejects.toThrow('Unable to decrypt passkey wallet.')
  })

  it('rejects a PRF output that is not 32 bytes', async () => {
    const { record } = await register()
    authenticator.prfOutputLength = 16

    await expect(
      unlockBrowserPasskeyVault({ records: [record], rpId })
    ).rejects.toThrow('This passkey returned an invalid PRF output.')
  })

  it('does not prompt when no vault is available', async () => {
    await expect(
      unlockBrowserPasskeyVault({ records: [], rpId })
    ).rejects.toThrow('No encrypted vault record is available.')
    expect(authenticator.assertions).toHaveLength(0)
  })

  it('zeroes every copy of the PRF output handed to Web Crypto', async () => {
    const { record } = await register()
    const subtle = globalThis.crypto.subtle
    const importKey = subtle.importKey.bind(subtle)
    const keyMaterials: ArrayBuffer[] = []
    jest
      .spyOn(subtle, 'importKey')
      .mockImplementation((async (...args: Parameters<SubtleCrypto['importKey']>) => {
        if (args[2] === 'HKDF') keyMaterials.push(args[1] as ArrayBuffer)
        return await importKey(...args)
      }) as SubtleCrypto['importKey'])

    await unlockBrowserPasskeyVault({ records: [record], rpId })

    expect(keyMaterials).toHaveLength(1)
    expect(new Uint8Array(keyMaterials[0]).every(byte => byte === 0)).toBe(true)
  })
})
