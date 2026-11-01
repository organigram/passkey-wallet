import { describe, expect, it, jest } from '@jest/globals'

import { parseInitialWalletLocationRequest } from './walletApp'

// The UI imports the published entry points; test against their sources.
jest.mock('@organigram/passkey-wallet/remote-protocol', () =>
  jest.requireActual('../../lib/remoteProtocol')
)
jest.mock('@organigram/passkey-wallet/sign-in-protocol', () =>
  jest.requireActual('../../lib/signInProtocol')
)

describe('wallet location requests', () => {
  const address = '0x41e699cCBe26b375FB5d926ef90873cde1787BEF'
  const transaction = JSON.stringify({
    from: address,
    to: '0x51E10ad4Eeb79e154bEe841FcBBAc83112122c7c',
    value: '0xde0b6b3a7640000'
  })
  const spoofedRequest = (type: string): URLSearchParams =>
    new URLSearchParams({
      type,
      version: '1',
      requestId: 'request-1',
      appOrigin: 'https://organigram.ai',
      domain: 'organigram.ai',
      chainId: '1',
      requestedAt: '2026-10-27T00:00:00.000Z',
      address,
      message: 'gm',
      transaction
    })

  it.each([
    'organigram:wallet:sign-message',
    'organigram:wallet:sign-typed-data',
    'organigram:wallet:send-transaction'
  ])('refuses %s requests whose origin is only declared in the URL', type => {
    expect(() =>
      parseInitialWalletLocationRequest({
        pathname: '/request',
        search: `?${spoofedRequest(type).toString()}`
      })
    ).toThrow('Wallet requests must be delivered by postMessage.')
  })

  it('waits for the postMessage payload of a signing request', () => {
    const params = spoofedRequest('organigram:wallet:send-transaction')
    params.set('messageTransport', 'post-message')

    expect(
      parseInitialWalletLocationRequest({
        pathname: '/request',
        search: `?${params.toString()}`
      })
    ).toEqual({ kind: 'none' })
  })
})
