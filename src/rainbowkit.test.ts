import {
  createOrganigramPasskeyWallet,
  isOrganigramPasskeyConnector,
  organigramPasskeyWalletId
} from './rainbowkit'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rainbowkitPath = resolve('src/rainbowkit.ts')
const eip1193Path = resolve('src/eip1193.ts')

describe('Organigram passkey RainbowKit wallet', () => {
  it('builds the Organigram passkey wallet descriptor', () => {
    const wallet = createOrganigramPasskeyWallet({
      unlockOrCreatePasskeyWallet: async () => {
        throw new Error('not used')
      },
      registerAdditionalPasskeyCredential: async () => {
        throw new Error('not used')
      },
      exportPasskeyWalletRecoveryPhrase: async () => {
        throw new Error('not used')
      }
    })

    expect(wallet.id).toBe(organigramPasskeyWalletId)
    expect(wallet.name).toBe('Passkey Wallet')
    expect(wallet.shortName).toBe('Passkey')
    expect(isOrganigramPasskeyConnector({ id: wallet.id })).toBe(true)
  })

  it('exposes a local Wagmi connector backed by the Organigram passkey provider', () => {
    expect(readFileSync(rainbowkitPath, 'utf8')).toMatch(/createConnector/)
    expect(readFileSync(rainbowkitPath, 'utf8')).toMatch(
      /createPasskeyWalletProvider/
    )
    expect(readFileSync(eip1193Path, 'utf8')).toMatch(/organigram_addPasskey/)
    expect(readFileSync(eip1193Path, 'utf8')).not.toMatch(
      /organigram_exportIpfsPrivateKey/
    )
  })
})
