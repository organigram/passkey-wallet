import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { hydratePasskeyPrfOptions } from './webauthn-client'

const webauthnClientPath = resolve('src/webauthn-client.ts')
const walletPath = resolve('src/wallet.ts')

describe('passkey WebAuthn client helpers', () => {
  it('hydrates serialized WebAuthn PRF extension inputs before browser ceremonies', () => {
    const serializedFirst = Object.fromEntries(
      Array.from({ length: 32 }, (_, index) => [String(index), index])
    )
    const options = hydratePasskeyPrfOptions({
      challenge: 'challenge',
      user: {
        id: 'user',
        name: 'user@example.com',
        displayName: 'user@example.com'
      },
      pubKeyCredParams: [],
      extensions: {
        prf: {
          eval: {
            first: serializedFirst
          },
          evalByCredential: {
            credential: {
              first: Array.from({ length: 32 }, (_, index) => 31 - index)
            }
          }
        }
      }
    })

    const prf = (options.extensions as {
      prf?: {
        eval?: { first?: unknown }
        evalByCredential?: Record<string, { first?: unknown }>
      }
    }).prf

    expect(prf?.eval?.first).toBeInstanceOf(Uint8Array)
    expect(Array.from(prf?.eval?.first as Uint8Array)).toEqual(
      Array.from({ length: 32 }, (_, index) => index)
    )
    expect(prf?.evalByCredential?.credential.first).toBeInstanceOf(Uint8Array)
    expect(
      Array.from(prf?.evalByCredential?.credential.first as Uint8Array)
    ).toEqual(Array.from({ length: 32 }, (_, index) => 31 - index))
  })

  it('creates passkey wallets from a mnemonic recovery phrase, not a raw private key', () => {
    const source = readFileSync(walletPath, 'utf8')

    expect(source).toMatch(/generateMnemonic/)
    expect(source).toMatch(/mnemonicToAccount/)
    expect(source).toMatch(/english/)
    expect(source).not.toMatch(/generatePrivateKey/)
  })

  it('exports a recovery phrase for mnemonic-backed passkey wallets', () => {
    const source = readFileSync(webauthnClientPath, 'utf8')

    expect(source).toMatch(/exportPasskeyWalletRecoveryPhrase/)
    expect(source).toMatch(/recoveryPhrase/)
    expect(source).not.toMatch(/exportPasskeyWalletPrivateKey/)
  })

  it('shows a user-facing message when a passkey provider does not return PRF output', () => {
    const source = readFileSync(webauthnClientPath, 'utf8')
    const errorsSource = readFileSync(resolve('src/errors.ts'), 'utf8')

    expect(source).toMatch(/PasskeyPrfUnavailableError/)
    expect(errorsSource).toMatch(
      /This password manager is not compatible with Organigram's passkey wallet\. Please use a different password manager to unlock your wallet\./
    )
    expect(source).not.toMatch(/Ce gestionnaire/)
    expect(errorsSource).not.toMatch(/Ce gestionnaire/)
    expect(source).not.toMatch(/WebAuthn PRF is not supported/)
  })
})
