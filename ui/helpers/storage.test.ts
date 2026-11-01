import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import {
  archivedVaultsStorageKey,
  loadLocalVaults,
  saveLocalVaults
} from './storage'

// The UI imports the published entry points; test against their sources.
jest.mock('@organigram/passkey-wallet/local-vault', () =>
  jest.requireActual('../../lib/localVault')
)

const storageKey = 'passkey-wallet.vaults.v1'

const legacyVault = {
  version: 1,
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  credentialId: 'legacy-passkey',
  envelope: {
    algorithm: 'AES-GCM-HKDF-SHA-256',
    keyVersion: 1,
    ciphertext: 'legacy-ciphertext',
    salt: 'legacy-salt',
    nonce: 'legacy-nonce'
  }
}

describe('local vault storage', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map()
    Object.assign(globalThis, {
      window: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value)
        }
      }
    })
  })

  const readArchive = (): unknown =>
    JSON.parse(storage.get(archivedVaultsStorageKey) ?? 'null')

  it('archives vaults it cannot read before a save drops them', () => {
    storage.set(storageKey, JSON.stringify({ version: 1, vaults: [legacyVault] }))

    saveLocalVaults(loadLocalVaults())

    expect(JSON.parse(storage.get(storageKey)!).vaults).toEqual([])
    expect(readArchive()).toEqual([legacyVault])
  })

  it('archives each unreadable vault once and never removes one', () => {
    const otherVault = { ...legacyVault, credentialId: 'other-passkey' }
    storage.set(storageKey, JSON.stringify({ version: 1, vaults: [legacyVault] }))
    loadLocalVaults()
    loadLocalVaults()
    storage.set(storageKey, JSON.stringify({ version: 1, vaults: [otherVault] }))
    loadLocalVaults()

    expect(readArchive()).toEqual([legacyVault, otherVault])
  })

  it('does not overwrite an archive it cannot parse', () => {
    storage.set(archivedVaultsStorageKey, 'not json')
    storage.set(storageKey, JSON.stringify({ version: 1, vaults: [legacyVault] }))

    loadLocalVaults()

    expect(storage.get(archivedVaultsStorageKey)).toBe('not json')
  })
})
