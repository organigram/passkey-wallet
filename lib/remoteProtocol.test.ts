import {
  buildPasskeyWalletRemotePopupUrl,
  assertPasskeyWalletSignMessageResult,
  assertPasskeyWalletSignTypedDataResult,
  passkeyWalletSignMessageType,
  passkeyWalletSignMessageResultType,
  passkeyWalletSignTypedDataResultType,
  passkeyWalletSignTypedDataType,
  type PasskeyWalletSignMessageResult
} from './remoteProtocol'
import { privateKeyToAccount } from 'viem/accounts'

describe('Organigram wallet remote protocol', () => {
  const account = privateKeyToAccount(
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  )
  const otherAccount = privateKeyToAccount(
    '0x1111111111111111111111111111111111111111111111111111111111111111'
  )
  const typedData = {
    domain: {
      name: 'MetaGasStation',
      version: '1',
      chainId: 31337,
      verifyingContract: '0x0000000000000000000000000000000000000001'
    },
    types: {
      ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint48' },
        { name: 'data', type: 'bytes' }
      ]
    },
    primaryType: 'ForwardRequest',
    message: {
      from: account.address,
      to: '0x0000000000000000000000000000000000000002',
      value: 0n,
      gas: 100000n,
      nonce: 0n,
      deadline: 1800000000,
      data: '0x'
    }
  } as const

  const createResult = async (): Promise<PasskeyWalletSignMessageResult> => ({
    type: passkeyWalletSignMessageResultType,
    version: 1 as const,
    requestId: 'request-1',
    domain: 'app.example',
    address: account.address,
    chainId: 11155111,
    completedAt: '2026-08-07T00:00:00.000Z',
    message: 'hello',
    signature: await account.signMessage({ message: 'hello' })
  })

  it('accepts a sign-message result for the requested address, chain, and message', async () => {
    const baseResult = await createResult()

    await expect(
      assertPasskeyWalletSignMessageResult({
        result: baseResult as PasskeyWalletSignMessageResult,
        address: baseResult.address,
        chainId: baseResult.chainId,
        message: baseResult.message
      })
    ).resolves.toBeUndefined()
  })

  it('rejects a sign-message result returned for a different address', async () => {
    const baseResult = await createResult()

    await expect(
      assertPasskeyWalletSignMessageResult({
        result: {
          ...baseResult,
          address: '0x41e699cCBe26b375FB5d926ef90873cde1787BEF'
        } as PasskeyWalletSignMessageResult,
        address: baseResult.address,
        chainId: baseResult.chainId,
        message: baseResult.message
      })
    ).rejects.toThrow(
      'returned a signature for 0x41e699cCBe26b375FB5d926ef90873cde1787BEF'
    )
  })

  it('rejects a sign-message result returned for a different chain', async () => {
    const baseResult = await createResult()

    await expect(
      assertPasskeyWalletSignMessageResult({
        result: {
          ...baseResult,
          chainId: 1
        } as PasskeyWalletSignMessageResult,
        address: baseResult.address,
        chainId: baseResult.chainId,
        message: baseResult.message
      })
    ).rejects.toThrow('returned a signature for chain 1')
  })

  it('accepts a mismatched result message when the signature validates the requested message', async () => {
    const baseResult = await createResult()

    await expect(
      assertPasskeyWalletSignMessageResult({
        result: {
          ...baseResult,
          message: 'goodbye'
        },
        address: baseResult.address,
        chainId: baseResult.chainId,
        message: baseResult.message
      })
    ).resolves.toBeUndefined()
  })

  it('rejects a signature produced for a different message', async () => {
    const baseResult = await createResult()
    const signature = await account.signMessage({ message: 'goodbye' })

    await expect(
      assertPasskeyWalletSignMessageResult({
        result: {
          ...baseResult,
          message: 'goodbye',
          signature
        },
        address: baseResult.address,
        chainId: baseResult.chainId,
        message: baseResult.message
      })
    ).rejects.toThrow('Organigram Wallet signature recovered')
  })

  it('rejects a signature produced by a different private key', async () => {
    const baseResult = await createResult()
    const signature = await otherAccount.signMessage({ message: baseResult.message })

    await expect(
      assertPasskeyWalletSignMessageResult({
        result: {
          ...baseResult,
          signature
        },
        address: baseResult.address,
        chainId: baseResult.chainId,
        message: baseResult.message
      })
    ).rejects.toThrow(`recovered ${otherAccount.address}`)
  })

  it('can build a sign-message popup URL without embedding the full message', () => {
    const message = 'hello'.repeat(10_000)
    const url = buildPasskeyWalletRemotePopupUrl({
      walletOrigin: 'https://wallet.example',
      appOrigin: 'https://app.example',
      type: passkeyWalletSignMessageType,
      chainId: 11155111,
      requestId: 'request-1',
      requestedAt: '2026-08-07T00:00:00.000Z',
      address: account.address,
      message,
      messageTransport: 'post-message'
    })

    expect(url.toString()).not.toContain(message)
    expect(url.searchParams.get('message')).toBeNull()
    expect(url.searchParams.get('messageTransport')).toBe('post-message')
  })

  it('accepts a sign-typed-data result for the requested payload', async () => {
    const signature = await account.signTypedData(typedData)

    await expect(
      assertPasskeyWalletSignTypedDataResult({
        result: {
          type: passkeyWalletSignTypedDataResultType,
          version: 1,
          requestId: 'request-1',
          domain: 'app.example',
          address: account.address,
          chainId: 31337,
          completedAt: '2026-08-07T00:00:00.000Z',
          typedData,
          signature
        },
        address: account.address,
        chainId: 31337,
        typedData
      })
    ).resolves.toBeUndefined()
  })

  it('rejects a typed-data signature produced for a different payload', async () => {
    const signature = await otherAccount.signTypedData(typedData)

    await expect(
      assertPasskeyWalletSignTypedDataResult({
        result: {
          type: passkeyWalletSignTypedDataResultType,
          version: 1,
          requestId: 'request-1',
          domain: 'app.example',
          address: account.address,
          chainId: 31337,
          completedAt: '2026-08-07T00:00:00.000Z',
          typedData,
          signature
        },
        address: account.address,
        chainId: 31337,
        typedData
      })
    ).rejects.toThrow(`recovered ${otherAccount.address}`)
  })

  it('can build a sign-typed-data popup URL without embedding the full payload', () => {
    const url = buildPasskeyWalletRemotePopupUrl({
      walletOrigin: 'https://wallet.example',
      appOrigin: 'https://app.example',
      type: passkeyWalletSignTypedDataType,
      chainId: 31337,
      requestId: 'request-1',
      requestedAt: '2026-08-07T00:00:00.000Z',
      address: account.address,
      typedData,
      messageTransport: 'post-message'
    })

    expect(url.toString()).not.toContain('ForwardRequest')
    expect(url.searchParams.get('typedData')).toBeNull()
    expect(url.searchParams.get('messageTransport')).toBe('post-message')
  })
})
