import {
  getAddress,
  isAddress,
  isHex,
  recoverMessageAddress,
  recoverTypedDataAddress
} from 'viem'

import { normalizeHost, requireString } from './protocol'

export const passkeyWalletConnectType = 'organigram:wallet:connect'
export const passkeyWalletConnectResultType = 'organigram:wallet:connect-result'
export const passkeyWalletSignMessageType = 'organigram:wallet:sign-message'
export const passkeyWalletSignMessageResultType =
  'organigram:wallet:sign-message-result'
export const passkeyWalletSignTypedDataType =
  'organigram:wallet:sign-typed-data'
export const passkeyWalletSignTypedDataResultType =
  'organigram:wallet:sign-typed-data-result'
export const passkeyWalletSendTransactionType =
  'organigram:wallet:send-transaction'
export const passkeyWalletSendTransactionResultType =
  'organigram:wallet:send-transaction-result'
export const passkeyWalletRemoteErrorResultType =
  'organigram:wallet:remote-error'
export const passkeyWalletDisconnectType = 'organigram:wallet:disconnect'
export const passkeyWalletRemoteRequestPayloadType =
  'organigram:wallet:request-payload'

export type PasskeyWalletRemoteRequestType =
  | typeof passkeyWalletConnectType
  | typeof passkeyWalletSignMessageType
  | typeof passkeyWalletSignTypedDataType
  | typeof passkeyWalletSendTransactionType
  | typeof passkeyWalletDisconnectType

type PasskeyWalletRemoteRequestBase = {
  type: PasskeyWalletRemoteRequestType
  version: 1
  requestId: string
  appOrigin: string
  domain: string
  chainId: number
  requestedAt: string
  /**
   * Optional context for a sequence of wallet approvals initiated by the app.
   * It is informational only and never changes what the wallet signs.
   */
  approvalStep?: number
  approvalCount?: number
  approvalLabel?: string
}

export type PasskeyWalletConnectRequest = PasskeyWalletRemoteRequestBase & {
  type: typeof passkeyWalletConnectType
}

export type PasskeyWalletSignMessageRequest = PasskeyWalletRemoteRequestBase & {
  type: typeof passkeyWalletSignMessageType
  address: `0x${string}`
  message: string
}

export type PasskeyWalletTypedData = {
  domain: Record<string, unknown>
  types: Record<string, ReadonlyArray<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
}

export type PasskeyWalletSignTypedDataRequest =
  PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSignTypedDataType
    address: `0x${string}`
    typedData: PasskeyWalletTypedData
  }

export type PasskeyWalletTransaction = {
  from: `0x${string}`
  to: `0x${string}`
  data?: `0x${string}`
  value?: `0x${string}`
  gas?: `0x${string}`
  gasPrice?: `0x${string}`
  maxFeePerGas?: `0x${string}`
  maxPriorityFeePerGas?: `0x${string}`
  nonce?: `0x${string}`
}

export type PasskeyWalletSendTransactionRequest =
  PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSendTransactionType
    address: `0x${string}`
    transaction: PasskeyWalletTransaction
  }

export type PasskeyWalletRemoteRequest =
  | PasskeyWalletConnectRequest
  | PasskeyWalletSignMessageRequest
  | PasskeyWalletSignTypedDataRequest
  | PasskeyWalletSendTransactionRequest

export type PasskeyWalletDisconnectRequest = PasskeyWalletRemoteRequestBase & {
  type: typeof passkeyWalletDisconnectType
  address: `0x${string}`
}

type PasskeyWalletRemoteResultBase = {
  version: 1
  requestId: string
  domain: string
  address: `0x${string}`
  chainId: number
  completedAt: string
}

export type PasskeyWalletConnectResult = PasskeyWalletRemoteResultBase & {
  type: typeof passkeyWalletConnectResultType
}

export type PasskeyWalletSignMessageResult = PasskeyWalletRemoteResultBase & {
  type: typeof passkeyWalletSignMessageResultType
  message: string
  signature: `0x${string}`
}

export type PasskeyWalletSignTypedDataResult = PasskeyWalletRemoteResultBase & {
  type: typeof passkeyWalletSignTypedDataResultType
  typedData: PasskeyWalletTypedData
  signature: `0x${string}`
}

export type PasskeyWalletSendTransactionResult =
  PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSendTransactionResultType
    transactionHash: `0x${string}`
  }

export type PasskeyWalletRemoteErrorResult = Omit<
  PasskeyWalletRemoteResultBase,
  'address'
> & {
  type: typeof passkeyWalletRemoteErrorResultType
  address?: undefined
  error: string
}

export type PasskeyWalletRemoteResult =
  | PasskeyWalletConnectResult
  | PasskeyWalletSignMessageResult
  | PasskeyWalletSignTypedDataResult
  | PasskeyWalletSendTransactionResult
  | PasskeyWalletRemoteErrorResult

export type PasskeyWalletRemoteRequestPayloadMessage = {
  type: typeof passkeyWalletRemoteRequestPayloadType
  version: 1
  request: PasskeyWalletRemoteRequest
}

export type PasskeyWalletRemotePopupInput = {
  walletOrigin?: string
  appOrigin?: string
  chainId: number
  requestId?: string
  requestedAt?: string
  messageTransport?: 'query' | 'post-message'
  approvalStep?: number
  approvalCount?: number
  approvalLabel?: string
}

export type PasskeyWalletConnectPopupInput = PasskeyWalletRemotePopupInput

export type PasskeyWalletSignMessagePopupInput =
  PasskeyWalletRemotePopupInput & {
    address: `0x${string}`
    message: string
  }

export type PasskeyWalletSignTypedDataPopupInput =
  PasskeyWalletRemotePopupInput & {
    address: `0x${string}`
    typedData: PasskeyWalletTypedData
  }

export const assertPasskeyWalletSignMessageResult = async ({
  result,
  address,
  chainId,
  message
}: {
  result: PasskeyWalletSignMessageResult
  address: `0x${string}`
  chainId: number
  message: string
}): Promise<void> => {
  const expectedAddress = getAddress(address)
  const resultAddress = getAddress(result.address)

  if (resultAddress !== expectedAddress) {
    throw new Error(
      `Organigram Wallet returned a signature for ${resultAddress}, expected ${expectedAddress}.`
    )
  }

  if (result.chainId !== chainId) {
    throw new Error(
      `Organigram Wallet returned a signature for chain ${result.chainId}, expected ${chainId}.`
    )
  }

  const recoveredAddress = await recoverMessageAddress({
    message,
    signature: result.signature
  })

  if (getAddress(recoveredAddress) !== expectedAddress) {
    throw new Error(
      `Organigram Wallet signature recovered ${recoveredAddress}, expected ${expectedAddress}.`
    )
  }
}

export const assertPasskeyWalletSignTypedDataResult = async ({
  result,
  address,
  chainId,
  typedData
}: {
  result: PasskeyWalletSignTypedDataResult
  address: `0x${string}`
  chainId: number
  typedData: PasskeyWalletTypedData
}): Promise<void> => {
  const expectedAddress = getAddress(address)
  const resultAddress = getAddress(result.address)

  if (resultAddress !== expectedAddress) {
    throw new Error(
      `Organigram Wallet returned a signature for ${resultAddress}, expected ${expectedAddress}.`
    )
  }

  if (result.chainId !== chainId) {
    throw new Error(
      `Organigram Wallet returned a signature for chain ${result.chainId}, expected ${chainId}.`
    )
  }

  const recoveredAddress = await recoverTypedDataAddress({
    ...typedData,
    signature: result.signature
  } as Parameters<typeof recoverTypedDataAddress>[0])

  if (getAddress(recoveredAddress) !== expectedAddress) {
    throw new Error(
      `Organigram Wallet typed-data signature recovered ${recoveredAddress}, expected ${expectedAddress}.`
    )
  }
}

export const isPasskeyWalletRemoteRequestPayloadMessage = (
  value: unknown,
  expectedRequestId?: string
): value is PasskeyWalletRemoteRequestPayloadMessage => {
  if (typeof value !== 'object' || value == null) return false

  const payload = value as Partial<PasskeyWalletRemoteRequestPayloadMessage>
  if (
    payload.type !== passkeyWalletRemoteRequestPayloadType ||
    payload.version !== 1 ||
    typeof payload.request !== 'object' ||
    payload.request == null
  ) {
    return false
  }

  const request = payload.request as Partial<PasskeyWalletRemoteRequest>
  if (expectedRequestId != null && request.requestId !== expectedRequestId) {
    return false
  }

  const hasRemoteRequestBase =
    request.version === 1 &&
    typeof request.requestId === 'string' &&
    typeof request.appOrigin === 'string' &&
    typeof request.domain === 'string' &&
    typeof request.chainId === 'number' &&
    typeof request.requestedAt === 'string'

  if (!hasRemoteRequestBase) return false
  if (request.type === passkeyWalletConnectType) return true
  if (
    request.type !== passkeyWalletSignMessageType &&
    request.type !== passkeyWalletSignTypedDataType &&
    request.type !== passkeyWalletSendTransactionType
  ) {
    return false
  }

  if (request.type === passkeyWalletSignMessageType) {
    const signMessageRequest =
      request as Partial<PasskeyWalletSignMessageRequest>
    return (
      typeof signMessageRequest.address === 'string' &&
      typeof signMessageRequest.message === 'string'
    )
  }

  if (request.type === passkeyWalletSendTransactionType) {
    const transactionRequest =
      request as Partial<PasskeyWalletSendTransactionRequest>
    return (
      typeof transactionRequest.address === 'string' &&
      isPasskeyWalletTransaction(transactionRequest.transaction)
    )
  }

  const signTypedDataRequest =
    request as Partial<PasskeyWalletSignTypedDataRequest>
  return (
    typeof signTypedDataRequest.address === 'string' &&
    isPasskeyWalletTypedData(signTypedDataRequest.typedData)
  )
}

export const stringifyPasskeyWalletTypedData = (
  typedData: PasskeyWalletTypedData
): string =>
  JSON.stringify(typedData, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )

export const parsePasskeyWalletTypedData = (
  value: unknown
): PasskeyWalletTypedData => {
  const parsed =
    typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  if (!isPasskeyWalletTypedData(parsed)) {
    throw new Error('Organigram wallet expected EIP-712 typed data.')
  }

  return parsed
}

const isPasskeyWalletTypedData = (
  value: unknown
): value is PasskeyWalletTypedData => {
  if (typeof value !== 'object' || value == null) return false
  const typedData = value as Partial<PasskeyWalletTypedData>
  return (
    typeof typedData.domain === 'object' &&
    typedData.domain != null &&
    typeof typedData.types === 'object' &&
    typedData.types != null &&
    typeof typedData.primaryType === 'string' &&
    typeof typedData.message === 'object' &&
    typedData.message != null
  )
}

export const isPasskeyWalletTransaction = (
  value: unknown
): value is PasskeyWalletTransaction => {
  if (typeof value !== 'object' || value == null) return false
  const transaction = value as Partial<PasskeyWalletTransaction>
  if (!isAddress(transaction.from ?? '') || !isAddress(transaction.to ?? '')) {
    return false
  }
  return [
    'data',
    'value',
    'gas',
    'gasPrice',
    'maxFeePerGas',
    'maxPriorityFeePerGas',
    'nonce'
  ].every(key => {
    const field = transaction[key as keyof PasskeyWalletTransaction]
    return field == null || (typeof field === 'string' && isHex(field))
  })
}

const defaultWalletOrigin = 'https://localhost:3002'

const getConfiguredWalletOrigin = (): string | undefined =>
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL?.trim() || undefined
    : undefined

const requireHttpsOrigin = (value: string, field: string): URL => {
  const url = new URL(value)
  if (url.protocol !== 'https:') {
    throw new Error(`Organigram wallet ${field} must use HTTPS.`)
  }

  return url
}

const requireAddress = (value: unknown, field: string): `0x${string}` => {
  const address = requireString(value, field)
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Organigram wallet ${field} must be an Ethereum address.`)
  }

  return address as `0x${string}`
}

const requireChainId = (value: unknown): number => {
  const chainId = Number(requireString(value, 'chainId'))
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error('Organigram wallet chainId must be a positive integer.')
  }

  return chainId
}

const createRequestId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

export const buildPasskeyWalletRemotePopupUrl = ({
  walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin,
  appOrigin = window.location.origin,
  type,
  chainId,
  requestId = createRequestId(),
  requestedAt = new Date().toISOString(),
  address,
  message,
  typedData,
  transaction,
  messageTransport = 'query',
  approvalStep,
  approvalCount,
  approvalLabel
}: PasskeyWalletRemotePopupInput & {
  type: PasskeyWalletRemoteRequestType
  address?: `0x${string}`
  message?: string
  typedData?: PasskeyWalletTypedData
  transaction?: PasskeyWalletTransaction
}): URL => {
  const normalizedAppOrigin = requireHttpsOrigin(appOrigin, 'appOrigin').origin
  const popupUrl = requireHttpsOrigin(walletOrigin, 'walletOrigin')
  popupUrl.pathname = '/request'

  popupUrl.searchParams.set('type', type)
  popupUrl.searchParams.set('version', '1')
  popupUrl.searchParams.set('requestId', requestId)
  popupUrl.searchParams.set('appOrigin', normalizedAppOrigin)
  popupUrl.searchParams.set('domain', new URL(normalizedAppOrigin).host)
  popupUrl.searchParams.set('chainId', chainId.toString())
  popupUrl.searchParams.set('requestedAt', requestedAt)
  if (approvalStep != null && approvalCount != null) {
    popupUrl.searchParams.set('approvalStep', approvalStep.toString())
    popupUrl.searchParams.set('approvalCount', approvalCount.toString())
    if (approvalLabel != null && approvalLabel !== '') {
      popupUrl.searchParams.set('approvalLabel', approvalLabel)
    }
  }
  if (address != null) popupUrl.searchParams.set('address', address)
  if (message != null && messageTransport === 'post-message') {
    popupUrl.searchParams.set('messageTransport', messageTransport)
  } else if (message != null) {
    popupUrl.searchParams.set('message', message)
  }
  if (typedData != null && messageTransport === 'post-message') {
    popupUrl.searchParams.set('messageTransport', messageTransport)
  } else if (typedData != null) {
    popupUrl.searchParams.set(
      'typedData',
      stringifyPasskeyWalletTypedData(typedData)
    )
  }
  if (transaction != null && messageTransport === 'post-message') {
    popupUrl.searchParams.set('messageTransport', messageTransport)
  } else if (transaction != null) {
    popupUrl.searchParams.set('transaction', JSON.stringify(transaction))
  }

  return popupUrl
}

export const buildPasskeyWalletDisconnectUrl = ({
  walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin,
  appOrigin = window.location.origin,
  chainId,
  requestId = createRequestId(),
  requestedAt = new Date().toISOString(),
  address
}: PasskeyWalletRemotePopupInput & {
  address: `0x${string}`
}): URL =>
  buildPasskeyWalletRemotePopupUrl({
    walletOrigin,
    appOrigin,
    type: passkeyWalletDisconnectType,
    chainId,
    requestId,
    requestedAt,
    address
  })

export const parsePasskeyWalletRemoteRequest = (
  params: URLSearchParams
): PasskeyWalletRemoteRequest => {
  const type = requireString(params.get('type'), 'type')
  if (
    type !== passkeyWalletConnectType &&
    type !== passkeyWalletSignMessageType &&
    type !== passkeyWalletSignTypedDataType &&
    type !== passkeyWalletSendTransactionType
  ) {
    throw new Error('Unsupported Organigram wallet remote request type.')
  }

  const version = Number(requireString(params.get('version'), 'version'))
  if (version !== 1) {
    throw new Error('Unsupported Organigram wallet remote request version.')
  }

  const appOrigin = requireHttpsOrigin(
    requireString(params.get('appOrigin'), 'appOrigin'),
    'appOrigin'
  ).origin
  const domain = normalizeHost(requireString(params.get('domain'), 'domain'))
  if (domain !== normalizeHost(new URL(appOrigin).host)) {
    throw new Error('Organigram wallet request domain must match appOrigin.')
  }

  const approvalStep = params.get('approvalStep')
  const approvalCount = params.get('approvalCount')
  const parsedApprovalStep =
    approvalStep == null ? undefined : Number.parseInt(approvalStep, 10)
  const parsedApprovalCount =
    approvalCount == null ? undefined : Number.parseInt(approvalCount, 10)
  if (
    (parsedApprovalStep == null) !== (parsedApprovalCount == null) ||
    (parsedApprovalStep != null &&
      (parsedApprovalCount == null ||
        !Number.isSafeInteger(parsedApprovalStep) ||
        !Number.isSafeInteger(parsedApprovalCount) ||
        parsedApprovalStep < 1 ||
        parsedApprovalCount < parsedApprovalStep))
  ) {
    throw new Error('Invalid Organigram wallet approval sequence.')
  }

  const base = {
    version: 1 as const,
    requestId: requireString(params.get('requestId'), 'requestId'),
    appOrigin,
    domain,
    chainId: requireChainId(params.get('chainId')),
    requestedAt: requireString(params.get('requestedAt'), 'requestedAt'),
    ...(parsedApprovalStep == null
      ? {}
      : {
          approvalStep: parsedApprovalStep,
          approvalCount: parsedApprovalCount!,
          ...(params.get('approvalLabel') == null
            ? {}
            : { approvalLabel: params.get('approvalLabel')! })
        })
  }

  if (type === passkeyWalletConnectType) {
    return {
      ...base,
      type: passkeyWalletConnectType
    }
  }

  if (type === passkeyWalletSignMessageType) {
    return {
      ...base,
      type: passkeyWalletSignMessageType,
      address: requireAddress(params.get('address'), 'address'),
      message: requireString(params.get('message'), 'message')
    }
  }

  if (type === passkeyWalletSendTransactionType) {
    const address = requireAddress(params.get('address'), 'address')
    const transaction = JSON.parse(
      requireString(params.get('transaction'), 'transaction')
    ) as unknown
    if (
      !isPasskeyWalletTransaction(transaction) ||
      getAddress(transaction.from) !== getAddress(address)
    ) {
      throw new Error('Invalid Organigram wallet transaction request.')
    }
    return {
      ...base,
      type: passkeyWalletSendTransactionType,
      address,
      transaction
    }
  }

  return {
    ...base,
    type: passkeyWalletSignTypedDataType,
    address: requireAddress(params.get('address'), 'address'),
    typedData: parsePasskeyWalletTypedData(params.get('typedData'))
  }
}

export const parsePasskeyWalletDisconnectRequest = (
  params: URLSearchParams
): PasskeyWalletDisconnectRequest => {
  const type = requireString(params.get('type'), 'type')
  if (type !== passkeyWalletDisconnectType) {
    throw new Error('Unsupported Organigram wallet disconnect request type.')
  }

  const version = Number(requireString(params.get('version'), 'version'))
  if (version !== 1) {
    throw new Error('Unsupported Organigram wallet disconnect request version.')
  }

  const appOrigin = requireHttpsOrigin(
    requireString(params.get('appOrigin'), 'appOrigin'),
    'appOrigin'
  ).origin
  const domain = normalizeHost(requireString(params.get('domain'), 'domain'))
  if (domain !== normalizeHost(new URL(appOrigin).host)) {
    throw new Error('Organigram wallet disconnect domain must match appOrigin.')
  }

  return {
    type: passkeyWalletDisconnectType,
    version: 1,
    requestId: requireString(params.get('requestId'), 'requestId'),
    appOrigin,
    domain,
    chainId: requireChainId(params.get('chainId')),
    requestedAt: requireString(params.get('requestedAt'), 'requestedAt'),
    address: requireAddress(params.get('address'), 'address')
  }
}

const requestPasskeyWalletRemoteResult = async <
  TResult extends PasskeyWalletRemoteResult
>({
  popupUrl,
  requestId,
  expectedResultType,
  timeoutMs
}: {
  popupUrl: URL
  requestId: string
  expectedResultType: TResult['type']
  timeoutMs: number
}): Promise<TResult> => {
  const expectedOrigin = popupUrl.origin
  const popup = window.open(
    popupUrl.toString(),
    'passkey-wallet',
    'popup,width=480,height=720'
  )
  if (popup == null) {
    throw new Error('Unable to open Organigram Passkey Wallet popup.')
  }
  const openedPopup = popup

  return await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Organigram Passkey Wallet request timed out.'))
    }, timeoutMs)

    const cleanup = (): void => {
      window.clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
    }

    function handleMessage(event: MessageEvent): void {
      if (event.origin !== expectedOrigin) return
      const data = event.data as Partial<PasskeyWalletRemoteResult> | null
      if (
        data == null ||
        data.type !== expectedResultType ||
        data.version !== 1 ||
        data.requestId !== requestId ||
        typeof data.address !== 'string' ||
        typeof data.chainId !== 'number'
      ) {
        return
      }

      cleanup()
      openedPopup.close()
      resolve(data as TResult)
    }

    window.addEventListener('message', handleMessage)
  })
}

export const requestPasskeyWalletConnect = async ({
  timeoutMs = 5 * 60 * 1000,
  ...input
}: PasskeyWalletConnectPopupInput & {
  timeoutMs?: number
}): Promise<PasskeyWalletConnectResult> => {
  const requestId = input.requestId ?? createRequestId()
  const popupUrl = buildPasskeyWalletRemotePopupUrl({
    ...input,
    type: passkeyWalletConnectType,
    requestId
  })

  return await requestPasskeyWalletRemoteResult<PasskeyWalletConnectResult>({
    popupUrl,
    requestId,
    expectedResultType: passkeyWalletConnectResultType,
    timeoutMs
  })
}

export const requestPasskeyWalletSignMessage = async ({
  timeoutMs = 5 * 60 * 1000,
  ...input
}: PasskeyWalletSignMessagePopupInput & {
  timeoutMs?: number
}): Promise<PasskeyWalletSignMessageResult> => {
  const requestId = input.requestId ?? createRequestId()
  const popupUrl = buildPasskeyWalletRemotePopupUrl({
    ...input,
    type: passkeyWalletSignMessageType,
    requestId
  })

  const result =
    await requestPasskeyWalletRemoteResult<PasskeyWalletSignMessageResult>({
      popupUrl,
      requestId,
      expectedResultType: passkeyWalletSignMessageResultType,
      timeoutMs
    })
  await assertPasskeyWalletSignMessageResult({
    result,
    address: input.address,
    chainId: input.chainId,
    message: input.message
  })

  return result
}
