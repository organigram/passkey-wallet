import {
  decryptPasskeyVaultSecret,
  derivePasskeyVaultKey,
  encryptPasskeyVaultSecret,
  isPasskeyPrfSupported
} from './crypto'

describe('passkey vault crypto', () => {
  it('encrypts and decrypts vault plaintext with a PRF-derived key', async () => {
    const salt = new Uint8Array(32).fill(2)
    const nonce = new Uint8Array(12).fill(3)
    const key = await derivePasskeyVaultKey({
      prfOutput: new Uint8Array(32).fill(1),
      salt
    })

    const envelope = await encryptPasskeyVaultSecret({
      plaintext: 'secret vault payload',
      key,
      salt,
      nonce
    })

    await expect(
      decryptPasskeyVaultSecret({ envelope, key })
    ).resolves.toBe('secret vault payload')
  })

  it('rejects vault envelopes decrypted with the wrong passkey output', async () => {
    const salt = new Uint8Array(32).fill(13)
    const key = await derivePasskeyVaultKey({
      prfOutput: new Uint8Array(32).fill(1),
      salt
    })
    const wrongKey = await derivePasskeyVaultKey({
      prfOutput: new Uint8Array(32).fill(2),
      salt
    })
    const envelope = await encryptPasskeyVaultSecret({
      plaintext: 'secret vault payload',
      key,
      salt
    })

    await expect(
      decryptPasskeyVaultSecret({ envelope, key: wrongKey })
    ).rejects.toThrow(/Unable to decrypt passkey wallet/)
  })

  it('detects PRF support from client extension results', async () => {
    await expect(isPasskeyPrfSupported({ credential: null })).resolves.toBe(
      false
    )
    await expect(
      isPasskeyPrfSupported({
        credential: {
          getClientExtensionResults: () => ({ prf: { enabled: true } })
        }
      })
    ).resolves.toBe(true)
    await expect(
      isPasskeyPrfSupported({
        credential: {
          getClientExtensionResults: () => ({ prf: { enabled: false } })
        }
      })
    ).resolves.toBe(false)
  })
})
