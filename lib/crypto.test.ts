import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptPasskeyVaultSecret,
  derivePasskeyVaultKey,
  encryptPasskeyVaultSecret,
  isPasskeyPrfSupported,
  isPasskeyVaultEnvelope
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
      prfSalt: new Uint8Array(32).fill(4),
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
      salt,
      prfSalt: new Uint8Array(32).fill(4)
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

  it('separates keys derived from one PRF output for different purposes', async () => {
    const prfOutput = new Uint8Array(32).fill(1)
    const salt = new Uint8Array(32).fill(2)
    const vaultKey = await derivePasskeyVaultKey({ prfOutput, salt })
    const backupKey = await derivePasskeyVaultKey({
      prfOutput,
      salt,
      info: 'organigram-passkey-wallet-remote-backup-v2:0x00'
    })
    const envelope = await encryptPasskeyVaultSecret({
      plaintext: 'secret vault payload',
      key: vaultKey,
      salt,
      prfSalt: new Uint8Array(32).fill(4)
    })

    await expect(
      decryptPasskeyVaultSecret({ envelope, key: backupKey })
    ).rejects.toThrow(/Unable to decrypt passkey wallet/)
  })

  it('accepts only well-formed v2 vault envelopes', async () => {
    const salt = new Uint8Array(32).fill(2)
    const envelope = await encryptPasskeyVaultSecret({
      plaintext: 'secret vault payload',
      key: await derivePasskeyVaultKey({
        prfOutput: new Uint8Array(32).fill(1),
        salt
      }),
      salt,
      prfSalt: new Uint8Array(32).fill(4)
    })

    expect(isPasskeyVaultEnvelope(envelope)).toBe(true)
    expect(isPasskeyVaultEnvelope({ ...envelope, keyVersion: 1 })).toBe(false)
    expect(
      isPasskeyVaultEnvelope({
        ...envelope,
        prfSalt: bytesToBase64Url(new Uint8Array(16))
      })
    ).toBe(false)
    expect(
      isPasskeyVaultEnvelope({ ...envelope, nonce: `${envelope.nonce}=` })
    ).toBe(false)
    const { prfSalt: _prfSalt, ...withoutPrfSalt } = envelope
    expect(isPasskeyVaultEnvelope(withoutPrfSalt)).toBe(false)
  })

  it('rejects non-canonical base64url', () => {
    expect(base64UrlToBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]))
    expect(() => base64UrlToBytes('AQI*D')).toThrow()
    expect(() => base64UrlToBytes('AQ==')).toThrow()
    expect(() => base64UrlToBytes('AR')).toThrow('canonical')
  })
})
