import { jest } from '@jest/globals'
import {
  getAcceptedWalletOrigins,
  officialLocalWalletOrigin,
  officialWalletOrigin,
  passkeyWalletLocalHandoffType,
  passkeyWalletReadyType,
  postToWalletPopup,
  rememberWalletOrigin,
  toPreferredWalletUrl,
  watchLocalWalletPopup
} from './walletOrigin'

type Listener = (event: { origin: string, data: unknown }) => void

const installWindow = () => {
  const storage = new Map<string, string>()
  const listeners = new Set<Listener>()
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key)
      },
      setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener)
    }
  })
  return {
    dispatch: (origin: string, data: unknown) => {
      for (const listener of listeners) listener({ origin, data })
    },
    listeners
  }
}

const requestUrl = (origin: string) =>
  new URL(`${origin}/request?type=organigram%3Awallet%3Asign-in&requestId=req-1`)

describe('wallet origins', () => {
  beforeEach(() => {
    installWindow()
  })

  test('the official wallet also accepts its local copy, other wallets do not', () => {
    expect(getAcceptedWalletOrigins(`${officialWalletOrigin}/request`)).toEqual([
      officialWalletOrigin,
      officialLocalWalletOrigin
    ])
    expect(getAcceptedWalletOrigins('https://wallet.acme.com')).toEqual([
      'https://wallet.acme.com'
    ])
  })

  describe('a deployment that declares its local copy', () => {
    const env = process.env
    afterEach(() => {
      process.env = env
    })
    const configure = (walletUrl: string, localUrl: string) => {
      process.env = {
        ...env,
        NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL: walletUrl,
        NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_LOCAL_URL: localUrl
      }
    }

    test('accepts its local copy', () => {
      configure('https://wallet.acme.com', 'https://local.wallet.acme.com:3002')
      expect(getAcceptedWalletOrigins('https://wallet.acme.com')).toEqual([
        'https://wallet.acme.com',
        'https://local.wallet.acme.com:3002'
      ])
    })

    test('does not lend it to another wallet', () => {
      configure('https://wallet.acme.com', 'https://local.wallet.acme.com:3002')
      expect(getAcceptedWalletOrigins('https://wallet.other.com')).toEqual([
        'https://wallet.other.com'
      ])
    })

    test('ignores a copy that could not unlock its passkeys', () => {
      configure('https://wallet.acme.com', 'https://local.acme.com:3002')
      expect(getAcceptedWalletOrigins('https://wallet.acme.com')).toEqual([
        'https://wallet.acme.com'
      ])
      configure('https://wallet.acme.com', 'http://local.wallet.acme.com:3002')
      expect(getAcceptedWalletOrigins('https://wallet.acme.com')).toEqual([
        'https://wallet.acme.com'
      ])
    })
  })

  test('requests open on the local copy once it has answered, until the official wallet answers again', () => {
    const url = requestUrl(officialWalletOrigin)
    expect(toPreferredWalletUrl(url).toString()).toBe(url.toString())

    rememberWalletOrigin(officialWalletOrigin, officialLocalWalletOrigin)
    const preferred = toPreferredWalletUrl(url)
    expect(preferred.origin).toBe(officialLocalWalletOrigin)
    expect(preferred.pathname + preferred.search).toBe(url.pathname + url.search)

    rememberWalletOrigin(officialWalletOrigin, officialWalletOrigin)
    expect(toPreferredWalletUrl(url).origin).toBe(officialWalletOrigin)
  })

  test('a remembered origin that is not accepted is ignored', () => {
    window.localStorage.setItem(
      `organigram.passkeyWallet.preferredOrigin:${officialWalletOrigin}`,
      'https://evil.example'
    )
    expect(toPreferredWalletUrl(requestUrl(officialWalletOrigin)).origin).toBe(
      officialWalletOrigin
    )
  })

  test('payloads are addressed to each accepted origin', () => {
    const postMessage = jest.fn()
    postToWalletPopup({ postMessage } as unknown as Window, { a: 1 }, officialWalletOrigin)
    expect(postMessage.mock.calls).toEqual([
      [{ a: 1 }, officialWalletOrigin],
      [{ a: 1 }, officialLocalWalletOrigin]
    ])
  })
})

describe('local wallet fallback', () => {
  let page: ReturnType<typeof installWindow>
  const popup = { closed: false, location: { href: '' } }

  beforeEach(() => {
    jest.useFakeTimers()
    page = installWindow()
    popup.location.href = ''
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const watch = (url: URL) =>
    watchLocalWalletPopup({
      popup: popup as unknown as Window,
      popupUrl: url,
      walletOrigin: officialWalletOrigin,
      requestId: 'req-1',
      timeoutMs: 1000
    })

  test('a local copy that does not answer sends the popup back to the official wallet', () => {
    rememberWalletOrigin(officialWalletOrigin, officialLocalWalletOrigin)
    watch(requestUrl(officialLocalWalletOrigin))
    jest.advanceTimersByTime(1000)

    const fallback = new URL(popup.location.href)
    expect(fallback.origin).toBe(officialWalletOrigin)
    expect(fallback.searchParams.get('localWallet')).toBe('off')
    expect(fallback.searchParams.get('requestId')).toBe('req-1')
    expect(toPreferredWalletUrl(requestUrl(officialWalletOrigin)).origin).toBe(
      officialWalletOrigin
    )
  })

  test('a local copy that answers keeps the request', () => {
    watch(requestUrl(officialLocalWalletOrigin))
    page.dispatch(officialLocalWalletOrigin, { type: passkeyWalletReadyType, requestId: 'req-1' })
    jest.advanceTimersByTime(1000)
    expect(popup.location.href).toBe('')
  })

  test('a hand-off from the official wallet waits for the local copy', () => {
    watch(requestUrl(officialWalletOrigin))
    jest.advanceTimersByTime(1000)
    expect(popup.location.href).toBe('')

    page.dispatch(officialWalletOrigin, { type: passkeyWalletLocalHandoffType, requestId: 'req-1' })
    jest.advanceTimersByTime(1000)
    expect(new URL(popup.location.href).origin).toBe(officialWalletOrigin)
  })

  test('messages of another request, or from another origin, are ignored', () => {
    watch(requestUrl(officialWalletOrigin))
    page.dispatch(officialWalletOrigin, { type: passkeyWalletLocalHandoffType, requestId: 'other' })
    page.dispatch('https://evil.example', { type: passkeyWalletLocalHandoffType, requestId: 'req-1' })
    jest.advanceTimersByTime(1000)
    expect(popup.location.href).toBe('')
  })

  test('the cleanup stops watching', () => {
    const stop = watch(requestUrl(officialLocalWalletOrigin))
    stop()
    jest.advanceTimersByTime(1000)
    expect(popup.location.href).toBe('')
    expect(page.listeners.size).toBe(0)
  })

  test('a wallet without local copy is not watched', () => {
    const stop = watchLocalWalletPopup({
      popup: popup as unknown as Window,
      popupUrl: new URL('https://wallet.acme.com/request?requestId=req-1'),
      walletOrigin: 'https://wallet.acme.com',
      requestId: 'req-1'
    })
    expect(page.listeners.size).toBe(0)
    stop()
  })
})
