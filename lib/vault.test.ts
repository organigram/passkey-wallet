import {
  parsePasskeyWalletVaultPayload,
  serializePasskeyWalletVaultPayload
} from './vault'

describe('passkey wallet vault payloads', () => {
  it('serializes and parses mnemonic-backed vault payloads', () => {
    const serialized = serializePasskeyWalletVaultPayload({
      recoveryPhrase: 'test test test test test test test test test test test junk'
    })

    expect(parsePasskeyWalletVaultPayload(serialized)).toMatchObject({
      version: 1,
      recoveryPhrase: 'test test test test test test test test test test test junk'
    })
  })
})
