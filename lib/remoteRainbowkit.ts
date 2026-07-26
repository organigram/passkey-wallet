import type { Wallet, WalletDetailsParams } from '@rainbow-me/rainbowkit'
import type { Chain, EIP1193RequestFn, Hex } from 'viem'
import { getAddress, hexToString, numberToHex } from 'viem'
import { createConnector } from 'wagmi'

import {
  buildPasskeyWalletDisconnectUrl,
  buildPasskeyWalletRemotePopupUrl,
  passkeyWalletConnectResultType,
  passkeyWalletConnectType,
  passkeyWalletSignMessageResultType,
  passkeyWalletSignMessageType,
  type PasskeyWalletConnectResult,
  type PasskeyWalletRemoteRequestType,
  type PasskeyWalletRemoteResult,
  type PasskeyWalletSignMessageResult
} from './remoteProtocol'
import {
  organigramPasskeyWalletIcon,
  organigramPasskeyWalletId,
  type PasskeyProviderEvent,
  type PasskeyProviderListener
} from './types'

const remoteWalletName = 'Passkey Wallet'
const remoteWalletId = organigramPasskeyWalletId
const remoteWalletConnectionStorageKey =
  'organigram.remotePasskeyWallet.connection.v1'

export const organigramRemotePasskeyWalletId = remoteWalletId

export type OrganigramRemotePasskeyWalletConnection = {
  version: 1
  address: `0x${string}`
  chainId: number
  connectedAt: string
}

type RemotePasskeyWalletProvider = {
  request: EIP1193RequestFn
  on: (event: PasskeyProviderEvent, listener: PasskeyProviderListener) => void
  removeListener: (
    event: PasskeyProviderEvent,
    listener: PasskeyProviderListener
  ) => void
}

type RemoteRequestConnect = (input: {
  chainId: number
}) => Promise<PasskeyWalletConnectResult>

type RemoteRequestPersonalSign = (input: {
  address: `0x${string}`
  chainId: number
  message: string
}) => Promise<PasskeyWalletSignMessageResult>

export type CreateOrganigramRemotePasskeyWalletInput = {
  walletOrigin?: string
  requestConnect?: RemoteRequestConnect
  requestPersonalSign?: RemoteRequestPersonalSign
}

export type HydrateOrganigramRemoteWalletConnectionInput = {
  address: `0x${string}`
  chainId?: number
}

export type HydrateOrganigramRemoteWalletConnectionConnector = {
  id: string
}

export type HydrateOrganigramRemoteWalletConnectionOptions<
  TConnector extends HydrateOrganigramRemoteWalletConnectionConnector
> = HydrateOrganigramRemoteWalletConnectionInput & {
  connectors: readonly TConnector[]
  connectAsync: (input: { connector: TConnector }) => Promise<unknown>
  defaultChainId?: number
}

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const parseStoredConnection = (
  value: string | null
): OrganigramRemotePasskeyWalletConnection | null => {
  if (value == null || value === '') return null

  try {
    const parsed = JSON.parse(value) as Partial<OrganigramRemotePasskeyWalletConnection>
    if (
      parsed.version !== 1 ||
      typeof parsed.address !== 'string' ||
      typeof parsed.chainId !== 'number' ||
      !Number.isSafeInteger(parsed.chainId) ||
      parsed.chainId <= 0 ||
      typeof parsed.connectedAt !== 'string'
    ) {
      return null
    }

    return {
      version: 1,
      address: getAddress(parsed.address),
      chainId: parsed.chainId,
      connectedAt: parsed.connectedAt
    }
  } catch {
    return null
  }
}

export const getOrganigramRemotePasskeyWalletConnection =
  (): OrganigramRemotePasskeyWalletConnection | null =>
    parseStoredConnection(
      getLocalStorage()?.getItem(remoteWalletConnectionStorageKey) ?? null
    )

export const rememberOrganigramRemotePasskeyWalletConnection = ({
  address,
  chainId
}: {
  address: `0x${string}`
  chainId: number
}): void => {
  const storage = getLocalStorage()
  if (storage == null) return

  const connection: OrganigramRemotePasskeyWalletConnection = {
    version: 1,
    address: getAddress(address),
    chainId,
    connectedAt: new Date().toISOString()
  }

  try {
    storage.setItem(
      remoteWalletConnectionStorageKey,
      JSON.stringify(connection)
    )
  } catch {
    // Local storage can be unavailable in hardened browser modes.
  }
}

export const clearOrganigramRemotePasskeyWalletConnection = (): void => {
  try {
    getLocalStorage()?.removeItem(remoteWalletConnectionStorageKey)
  } catch {
    // Local storage can be unavailable in hardened browser modes.
  }
}

export const notifyOrganigramRemotePasskeyWalletDisconnect = ({
  walletOrigin,
  address,
  chainId
}: {
  walletOrigin?: string
  address: `0x${string}`
  chainId: number
}): void => {
  if (typeof window === 'undefined') return

  try {
    const url = buildPasskeyWalletDisconnectUrl({
      walletOrigin,
      address,
      chainId
    })
    const iframe = window.document.createElement('iframe')
    iframe.src = url.toString()
    iframe.hidden = true
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'absolute'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    window.document.body.appendChild(iframe)
    window.setTimeout(() => {
      iframe.remove()
    }, 3000)
  } catch {
    // Disconnect notifications should never block local disconnect.
  }
}

export const hydrateOrganigramRemoteWalletConnection = async <
  TConnector extends HydrateOrganigramRemoteWalletConnectionConnector
>({
  address,
  chainId,
  connectAsync,
  connectors,
  defaultChainId = 11155111
}: HydrateOrganigramRemoteWalletConnectionOptions<TConnector>): Promise<void> => {
  const resolvedChainId = chainId ?? defaultChainId
  rememberOrganigramRemotePasskeyWalletConnection({
    address,
    chainId: resolvedChainId
  })

  const connector = connectors.find(
    candidate => candidate.id === organigramRemotePasskeyWalletId
  )
  if (connector == null) return

  try {
    await connectAsync({ connector })
  } catch (error) {
    clearOrganigramRemotePasskeyWalletConnection()
    console.warn(
      'Unable to hydrate Organigram Passkey Wallet connection:',
      error
    )
  }
}

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `req_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`
}

const normalizePersonalSignMessage = (message: unknown): string => {
  if (typeof message !== 'string') {
    throw new Error('Organigram Wallet expected a string message.')
  }
  if (message.startsWith('0x')) {
    return hexToString(message as Hex)
  }

  return message
}

const createRemotePopupTransport = (walletOrigin?: string) => {
  let popup: Window | null = null
  let closeTimer: number | null = null

  const clearCloseTimer = (): void => {
    if (closeTimer == null) return

    window.clearTimeout(closeTimer)
    closeTimer = null
  }

  const closePopup = (): void => {
    clearCloseTimer()
    if (popup != null && !popup.closed) {
      popup.close()
    }
    popup = null
  }

  const schedulePopupClose = (): void => {
    clearCloseTimer()
    closeTimer = window.setTimeout(() => {
      closePopup()
    }, 30000)
  }

  const request = async <TResult extends PasskeyWalletRemoteResult>({
    type,
    expectedResultType,
    chainId,
    address,
    message,
    timeoutMs = 5 * 60 * 1000
  }: {
    type: PasskeyWalletRemoteRequestType
    expectedResultType: TResult['type']
    chainId: number
    address?: `0x${string}`
    message?: string
    timeoutMs?: number
  }): Promise<TResult> => {
    const requestId = createRequestId()
    const popupUrl = buildPasskeyWalletRemotePopupUrl({
      walletOrigin,
      type,
      requestId,
      chainId,
      ...(address == null ? {} : { address }),
      ...(message == null ? {} : { message })
    })
    const expectedOrigin = popupUrl.origin
    clearCloseTimer()

    if (popup == null || popup.closed) {
      popup = window.open(
        popupUrl.toString(),
        'passkey-wallet',
        'popup,width=480,height=720'
      )
    } else {
      popup.location.href = popupUrl.toString()
      popup.focus()
    }

    if (popup == null) {
      throw new Error('Unable to open Organigram Wallet popup.')
    }

    return await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup()
        closePopup()
        reject(new Error('Organigram Wallet request timed out.'))
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
        if (type === passkeyWalletConnectType) {
          schedulePopupClose()
        } else {
          closePopup()
        }
        resolve(data as TResult)
      }

      window.addEventListener('message', handleMessage)
    })
  }

  return {
    connect: async ({ chainId }: { chainId: number }) =>
      await request<PasskeyWalletConnectResult>({
        type: passkeyWalletConnectType,
        expectedResultType: passkeyWalletConnectResultType,
        chainId
      }),
    signMessage: async ({
      address,
      chainId,
      message
    }: {
      address: `0x${string}`
      chainId: number
      message: string
    }) =>
      await request<PasskeyWalletSignMessageResult>({
        type: passkeyWalletSignMessageType,
        expectedResultType: passkeyWalletSignMessageResultType,
        chainId,
        address,
        message
      })
  }
}

const createRemotePasskeyWalletProvider = ({
  getAddress,
  getChain,
  rpcUrl,
  switchChain,
  requestPersonalSign
}: {
  getAddress: () => `0x${string}` | null
  getChain: () => Chain
  rpcUrl: () => string
  switchChain: (chainId: number) => Chain
  requestPersonalSign: RemoteRequestPersonalSign
}): RemotePasskeyWalletProvider => {
  const listeners = new Map<PasskeyProviderEvent, Set<PasskeyProviderListener>>()

  const emit = (event: PasskeyProviderEvent, ...args: unknown[]): void => {
    listeners.get(event)?.forEach(listener => {
      listener(...args)
    })
  }

  const requireConnectedAddress = (): `0x${string}` => {
    const address = getAddress()
    if (address == null) {
      throw new Error('Organigram Wallet is not connected.')
    }

    return address
  }

  const request = (async ({ method, params }) => {
    const requestParams = Array.isArray(params) ? params : []

    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [requireConnectedAddress()]
      case 'eth_chainId':
        return numberToHex(getChain().id)
      case 'wallet_switchEthereumChain': {
        const chainId = Number.parseInt(
          String((requestParams[0] as { chainId?: string })?.chainId),
          16
        )
        const nextChain = switchChain(chainId)
        emit('chainChanged', numberToHex(nextChain.id))
        return null
      }
      case 'personal_sign': {
        const address = requireConnectedAddress()
        const result = await requestPersonalSign({
          address,
          chainId: getChain().id,
          message: normalizePersonalSignMessage(requestParams[0])
        })
        return result.signature
      }
      case 'eth_sign': {
        const address = requireConnectedAddress()
        const result = await requestPersonalSign({
          address,
          chainId: getChain().id,
          message: normalizePersonalSignMessage(requestParams[1])
        })
        return result.signature
      }
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4':
        throw new Error('Typed data signing is not available in Organigram Wallet yet.')
      case 'eth_sendTransaction':
        throw new Error(
          'Transaction signing is not available in Organigram Wallet yet.'
        )
      default: {
        const response = await fetch(rpcUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params: requestParams
          })
        })
        const body = (await response.json()) as {
          result?: unknown
          error?: { message?: string }
        }
        if (body.error != null) {
          throw new Error(body.error.message ?? 'RPC request failed.')
        }

        return body.result
      }
    }
  }) as EIP1193RequestFn

  return {
    request,
    on: (event, listener) => {
      const eventListeners = listeners.get(event) ?? new Set()
      eventListeners.add(listener)
      listeners.set(event, eventListeners)
    },
    removeListener: (event, listener) => {
      listeners.get(event)?.delete(listener)
    }
  }
}

export const createOrganigramRemotePasskeyWallet = ({
  walletOrigin,
  requestConnect,
  requestPersonalSign
}: CreateOrganigramRemotePasskeyWalletInput = {}): Wallet => {
  const remotePopupTransport = createRemotePopupTransport(walletOrigin)
  const connectRemote = requestConnect ?? remotePopupTransport.connect
  const signRemoteMessage =
    requestPersonalSign ?? remotePopupTransport.signMessage

  return {
    id: remoteWalletId,
    name: remoteWalletName,
    shortName: 'Organigram',
    rdns: 'ai.organigram.wallet',
    iconUrl: organigramPasskeyWalletIcon,
    iconAccent: '#00C2A8',
    iconBackground: '#18272B',
    installed: true,
    createConnector: (walletDetails: WalletDetailsParams) =>
      createConnector(config => {
        let provider: RemotePasskeyWalletProvider | null = null
        let address: `0x${string}` | null = null
        let activeChain = config.chains[0]

        const resolveChain = (chainId?: number): Chain => {
          const chain =
            chainId == null
              ? activeChain
              : config.chains.find(candidate => candidate.id === chainId)
          if (chain == null) {
            throw new Error('Unsupported network for Organigram Wallet.')
          }

          return chain
        }

        const getRpcUrl = (chain: Chain): string =>
          chain.rpcUrls.default.http[0] ?? chain.rpcUrls.public?.http[0] ?? ''

        const ensureProvider = (): RemotePasskeyWalletProvider => {
          provider ??= createRemotePasskeyWalletProvider({
            getAddress: () => address,
            getChain: () => activeChain,
            rpcUrl: () => getRpcUrl(activeChain),
            switchChain: chainId => {
              activeChain = resolveChain(chainId)
              config.emitter.emit('change', {
                chainId: activeChain.id
              })
              return activeChain
            },
            requestPersonalSign: signRemoteMessage
          })

          return provider
        }

        const restoreStoredConnection = (): boolean => {
          const connection = getOrganigramRemotePasskeyWalletConnection()
          if (connection == null) return false

          try {
            address = getAddress(connection.address)
            activeChain = resolveChain(connection.chainId)
            ensureProvider()
            return true
          } catch {
            address = null
            provider = null
            clearOrganigramRemotePasskeyWalletConnection()
            return false
          }
        }

        const formatConnectionResult = (
          withCapabilities?: boolean
        ):
          | {
              accounts: `0x${string}`[]
              chainId: number
            }
          | {
              accounts: Array<{ address: `0x${string}`; capabilities: {} }>
              chainId: number
            } => {
          if (address == null) {
            throw new Error('Organigram Wallet is not connected.')
          }

          if (withCapabilities === true) {
            return {
              accounts: [
                {
                  address,
                  capabilities: {}
                }
              ],
              chainId: activeChain.id
            }
          }

          return {
            accounts: [address],
            chainId: activeChain.id
          }
        }

        return {
          ...walletDetails,
          id: remoteWalletId,
          name: remoteWalletName,
          type: 'organigram-remote-wallet',
          async connect(parameters): Promise<any> {
            if (restoreStoredConnection()) {
              config.emitter.emit('connect', {
                accounts: address == null ? [] : [address],
                chainId: activeChain.id
              })
              return formatConnectionResult(parameters?.withCapabilities)
            }

            activeChain = resolveChain(parameters?.chainId)
            const connection = await connectRemote({
              chainId: activeChain.id
            })
            address = getAddress(connection.address)
            activeChain = resolveChain(connection.chainId)
            rememberOrganigramRemotePasskeyWalletConnection({
              address,
              chainId: activeChain.id
            })
            ensureProvider()
            config.emitter.emit('connect', {
              accounts: [address],
              chainId: activeChain.id
            })

            return formatConnectionResult(parameters?.withCapabilities)
          },
          async disconnect() {
            const connection =
              address == null
                ? getOrganigramRemotePasskeyWalletConnection()
                : {
                    version: 1 as const,
                    address,
                    chainId: activeChain.id,
                    connectedAt: new Date().toISOString()
                  }
            if (connection != null) {
              notifyOrganigramRemotePasskeyWalletDisconnect({
                walletOrigin,
                address: connection.address,
                chainId: connection.chainId
              })
            }
            address = null
            provider = null
            clearOrganigramRemotePasskeyWalletConnection()
            config.emitter.emit('disconnect')
          },
          async getAccounts() {
            if (address == null) {
              restoreStoredConnection()
            }
            return address == null ? [] : [address]
          },
          async getChainId() {
            if (address == null) {
              restoreStoredConnection()
            }
            return activeChain.id
          },
          async getProvider() {
            if (address == null) {
              restoreStoredConnection()
            }
            return ensureProvider()
          },
          async isAuthorized() {
            return address != null || restoreStoredConnection()
          },
          async switchChain({ chainId }) {
            activeChain = resolveChain(chainId)
            if (address != null) {
              rememberOrganigramRemotePasskeyWalletConnection({
                address,
                chainId: activeChain.id
              })
            }
            config.emitter.emit('change', {
              chainId
            })
            return activeChain
          },
          onAccountsChanged(accounts) {
            address =
              accounts[0] == null ? null : getAddress(accounts[0] as `0x${string}`)
            if (address == null) {
              clearOrganigramRemotePasskeyWalletConnection()
            } else {
              rememberOrganigramRemotePasskeyWalletConnection({
                address,
                chainId: activeChain.id
              })
            }
            config.emitter.emit('change', {
              accounts: address == null ? [] : [address]
            })
          },
          onChainChanged(chainId) {
            activeChain = resolveChain(Number.parseInt(chainId, 16))
            if (address != null) {
              rememberOrganigramRemotePasskeyWalletConnection({
                address,
                chainId: activeChain.id
              })
            }
            config.emitter.emit('change', {
              chainId: activeChain.id
            })
          },
          onDisconnect() {
            address = null
            provider = null
            clearOrganigramRemotePasskeyWalletConnection()
            config.emitter.emit('disconnect')
          }
        }
      })
  }
}
