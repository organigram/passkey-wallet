import {
  passkeyChallengeTtlMs,
  validatePasskeyVaultEnvelopeInput
} from './webauthn-server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const serverPath = resolve('src/webauthn-server.ts')

describe('passkey WebAuthn server helpers', () => {
  it('uses discoverable authentication without sending the global credential list', () => {
    const source = readFileSync(serverPath, 'utf8')

    expect(source).toMatch(/const isDiscoverableAuthentication = credentials\.length === 0/)
    expect(source).toMatch(/isDiscoverableAuthentication\s+\?\s+\{\s*eval:/)
    expect(source).toMatch(/\.\.\.\(!isDiscoverableAuthentication\s+\?\s+\{\s*allowCredentials:/)
  })

  it('requires discoverable credentials for passkey wallet registration', () => {
    const source = readFileSync(serverPath, 'utf8')

    expect(source).toMatch(/residentKey: 'required'/)
  })

  it('validates passkey vault envelopes without requiring a database', () => {
    expect(
      validatePasskeyVaultEnvelopeInput({
        address: '0x0000000000000000000000000000000000000001',
        encryptedVault: 'ciphertext',
        salt: 'salt',
        nonce: 'nonce',
        algorithm: 'AES-GCM-HKDF-SHA-256',
        keyVersion: 1
      })
    ).toMatchObject({
      address: '0x0000000000000000000000000000000000000001'
    })
  })

  it('keeps passkey challenges short-lived', () => {
    expect(passkeyChallengeTtlMs).toBe(5 * 60 * 1000)
  })
})
