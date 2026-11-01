import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('@organigram/passkey-wallet/sign-in-client', () => ({
  notifyPasskeyWalletStackSessionChanged: jest.fn()
}))

jest.mock('@organigram/passkey-wallet/backup', () => ({
  createRemoteVaultBackupPackage: jest.fn(),
  createRemoteVaultBackupRecord: jest.fn(),
  createVaultBackupDigest: jest.fn(),
  createVaultBackupSignatureMessage: jest.fn(),
  decryptRemoteVaultBackupRecord: jest.fn(),
  normalizeBackupAddress: jest.fn(),
  parseRemoteVaultBackupPackage: jest.fn()
}))

describe('wallet connection records', () => {
  const address = '0x41e699cCBe26b375FB5d926ef90873cde1787BEF' as const
  const otherAddress = '0x51E10ad4Eeb79e154bEe841FcBBAc83112122c7c' as const
  const appOrigin = 'http://localhost:3000'
  const domain = 'localhost:3000'
  const requestedAt = '2026-08-07T10:00:00.000Z'
  const completedAt = new Date('2026-08-07T10:01:00.000Z')
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map()
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        }
      }
    }
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('restores an active wallet connection from a matching Stack wallet session', async () => {
    const {
      ensureActiveWalletConnectionRecord,
      getActiveWalletConnectionRecord,
      loadWalletConnectionRecords
    } = await import('./walletConnections')

    const record = await (ensureActiveWalletConnectionRecord as CallableFunction)({
      domain,
      appOrigin,
      address,
      chainId: 31337,
      requestId: 'request-1',
      requestedAt,
      now: completedAt,
      fetchSession: async (origin: string) => {
        expect(origin).toBe(appOrigin)
        return {
          authenticated: true,
          address,
          authProvider: 'wallet'
        }
      }
    })

    expect(record).toMatchObject({
      kind: 'sign-in',
      requestId: 'request-1',
      domain,
      appOrigin,
      address,
      chainId: 31337,
      completedAt: completedAt.toISOString(),
      revokedAt: null
    })
    expect(loadWalletConnectionRecords()).toHaveLength(1)
    expect(
      getActiveWalletConnectionRecord({
        domain,
        appOrigin,
        address,
        chainId: 31337
      })
    ).not.toBeNull()
  })

  it('does not restore an active wallet connection for another session address', async () => {
    const { ensureActiveWalletConnectionRecord, loadWalletConnectionRecords } =
      await import('./walletConnections')

    const record = await (ensureActiveWalletConnectionRecord as CallableFunction)({
      domain,
      appOrigin,
      address,
      chainId: 31337,
      requestId: 'request-1',
      requestedAt,
      now: completedAt,
      fetchSession: async () => ({
        authenticated: true,
        address: otherAddress,
        authProvider: 'wallet'
      })
    })

    expect(record).toBeNull()
    expect(loadWalletConnectionRecords()).toEqual([])
  })

  it('does not restore an active wallet connection from a non-wallet Stack session', async () => {
    const { ensureActiveWalletConnectionRecord, loadWalletConnectionRecords } =
      await import('./walletConnections')

    const record = await (ensureActiveWalletConnectionRecord as CallableFunction)({
      domain,
      appOrigin,
      address,
      chainId: 31337,
      requestId: 'request-1',
      requestedAt,
      now: completedAt,
      fetchSession: async () => ({
        authenticated: true,
        address,
        authProvider: 'email'
      })
    })

    expect(record).toBeNull()
    expect(loadWalletConnectionRecords()).toEqual([])
  })

  it('keeps typed-data pending requests when reloading local storage', () => {
    const {
      recordWalletPendingConnectionRequest,
      loadWalletPendingConnectionRequests
    } = jest.requireActual('./walletConnections') as typeof import('./walletConnections')

    recordWalletPendingConnectionRequest({
      kind: 'sign-typed-data',
      requestId: 'typed-data-request',
      domain,
      appOrigin,
      address,
      chainId: 31337,
      requestedAt,
      expiresAt: '2099-01-01T00:00:00.000Z',
      requestUrl: `${appOrigin}/wallet/request?request=1`
    })

    expect(loadWalletPendingConnectionRequests()).toMatchObject([
      {
        kind: 'sign-typed-data',
        requestId: 'typed-data-request',
        domain,
        appOrigin,
        address,
        chainId: 31337
      }
    ])
  })
})
