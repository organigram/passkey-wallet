import {
  assertSignInDomainMatches,
  parsePasskeyWalletSignInRequest,
  resolveSiweDomain,
  validatePasskeyWalletManifest
} from './signInProtocol'

describe('Organigram wallet sign-in protocol', () => {
  it('parses a valid popup sign-in request from URL search params', () => {
    const params = new URLSearchParams({
      type: 'organigram:wallet:sign-in',
      version: '1',
      requestId: 'req_123',
      domain: 'organigram.ai',
      challengeUrl: 'https://organigram.ai/api/auth/wallet/challenge',
      returnUrl: 'https://organigram.ai/auth/wallet/complete',
      requestedAt: '2026-07-22T10:00:00.000Z'
    })

    expect(parsePasskeyWalletSignInRequest(params)).toEqual({
      type: 'organigram:wallet:sign-in',
      version: 1,
      requestId: 'req_123',
      domain: 'organigram.ai',
      challengeUrl: 'https://organigram.ai/api/auth/wallet/challenge',
      returnUrl: 'https://organigram.ai/auth/wallet/complete',
      requestedAt: '2026-07-22T10:00:00.000Z'
    })
  })

  it('rejects sign-in requests with a challenge outside the declared domain', () => {
    const params = new URLSearchParams({
      type: 'organigram:wallet:sign-in',
      version: '1',
      requestId: 'req_123',
      domain: 'organigram.ai',
      challengeUrl: 'https://evil.example/api/auth/wallet/challenge',
      requestedAt: '2026-07-22T10:00:00.000Z'
    })

    expect(() => parsePasskeyWalletSignInRequest(params)).toThrow(
      /challenge URL must belong to the requested domain/i
    )
  })

  it('validates manifests served by their declared domain', () => {
    expect(
      validatePasskeyWalletManifest(
        {
          version: 1,
          domain: 'organigram.ai',
          signInChallengeUrl: 'https://organigram.ai/api/auth/wallet/challenge',
          signInCompletionUrl: 'https://organigram.ai/api/auth/wallet/complete'
        },
        'organigram.ai'
      )
    ).toEqual({
      version: 1,
      domain: 'organigram.ai',
      signInChallengeUrl: 'https://organigram.ai/api/auth/wallet/challenge',
      signInCompletionUrl: 'https://organigram.ai/api/auth/wallet/complete'
    })
  })

  it('accepts local manifest and challenge URLs with explicit ports', () => {
    expect(
      validatePasskeyWalletManifest(
        {
          version: 1,
          domain: 'localhost:3000',
          signInChallengeUrl:
            'https://localhost:3000/api/auth/wallet/challenge'
        },
        'localhost:3000'
      )
    ).toMatchObject({
      domain: 'localhost:3000'
    })
  })

  it('rejects manifests whose declared domain does not match the serving host', () => {
    expect(() =>
      validatePasskeyWalletManifest(
        {
          version: 1,
          domain: 'organigram.ai',
          signInChallengeUrl: 'https://organigram.ai/api/auth/wallet/challenge'
        },
        'client.example'
      )
    ).toThrow(/manifest domain does not match/i)
  })

  it('extracts the SIWE domain and rejects mismatched sign-in domains', () => {
    const message = [
      'organigram.ai wants you to sign in with your Ethereum account:',
      '0x0000000000000000000000000000000000000000',
      '',
      'Sign in to Organigram.',
      '',
      'URI: https://organigram.ai',
      'Version: 1',
      'Chain ID: 11155111',
      'Nonce: abc12345',
      'Issued At: 2026-07-22T10:00:00.000Z'
    ].join('\n')

    expect(resolveSiweDomain(message)).toBe('organigram.ai')
    expect(() => assertSignInDomainMatches(message, 'organigram.ai')).not.toThrow()
    expect(() => assertSignInDomainMatches(message, 'evil.example')).toThrow(
      /SIWE domain mismatch/i
    )
  })
})
