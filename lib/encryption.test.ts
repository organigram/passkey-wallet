import {
  createWalletEncryptionKeyPair,
  decryptPayloadWithWalletEncryptionKey,
  encryptPayloadWithWalletEncryptionKey,
  parseWalletEncryptedPayload
} from './encryption'

describe('wallet encrypted payloads', () => {
  const address = '0x0000000000000000000000000000000000000001'
  const appOrigin = 'https://app.organigram.test'

  it('decrypts a payload for the application that encrypted it', async () => {
    const keyPair = await createWalletEncryptionKeyPair()
    const encryptedPayload = await encryptPayloadWithWalletEncryptionKey({
      address,
      appOrigin: `${appOrigin}/workspace`,
      plaintext: 'workspace-private-key',
      keyPair
    })

    expect(encryptedPayload.appOrigin).toBe(appOrigin)
    expect(JSON.stringify(encryptedPayload)).not.toContain('workspace-private-key')
    await expect(
      decryptPayloadWithWalletEncryptionKey({
        encryptedPayload: parseWalletEncryptedPayload(
          JSON.parse(JSON.stringify(encryptedPayload))
        ),
        appOrigin,
        keyPair
      })
    ).resolves.toBe('workspace-private-key')
  })

  it('refuses to decrypt a payload for another application', async () => {
    const keyPair = await createWalletEncryptionKeyPair()
    const encryptedPayload = await encryptPayloadWithWalletEncryptionKey({
      address,
      appOrigin,
      plaintext: 'workspace-private-key',
      keyPair
    })

    await expect(
      decryptPayloadWithWalletEncryptionKey({
        encryptedPayload,
        appOrigin: 'https://attacker.test',
        keyPair
      })
    ).rejects.toThrow('Encrypted payload was created for another application.')
  })

  it('refuses a payload relabelled for another application', async () => {
    const keyPair = await createWalletEncryptionKeyPair()
    const encryptedPayload = await encryptPayloadWithWalletEncryptionKey({
      address,
      appOrigin,
      plaintext: 'workspace-private-key',
      keyPair
    })

    await expect(
      decryptPayloadWithWalletEncryptionKey({
        encryptedPayload: { ...encryptedPayload, appOrigin: 'https://attacker.test' },
        appOrigin: 'https://attacker.test',
        keyPair
      })
    ).rejects.toThrow()
  })

  it('refuses a payload created for another wallet encryption key', async () => {
    const keyPair = await createWalletEncryptionKeyPair()
    const encryptedPayload = await encryptPayloadWithWalletEncryptionKey({
      address,
      appOrigin,
      plaintext: 'workspace-private-key',
      keyPair
    })

    await expect(
      decryptPayloadWithWalletEncryptionKey({
        encryptedPayload,
        appOrigin,
        keyPair: { ...keyPair, keyVersion: keyPair.keyVersion + 1 }
      })
    ).rejects.toThrow('Encrypted payload was created for another wallet encryption key.')
  })

  it('rejects a payload without an application origin', () => {
    expect(() =>
      parseWalletEncryptedPayload({
        version: 1,
        kind: 'organigram:wallet-encrypted-payload',
        algorithm: 'ECDH-P256+A256GCM',
        recipient: { address, publicKey: { kty: 'EC' }, keyVersion: 1 },
        iv: 'iv',
        ciphertext: 'ciphertext',
        encryptedAt: new Date().toISOString()
      })
    ).toThrow('Unsupported encrypted payload.')
  })
})
