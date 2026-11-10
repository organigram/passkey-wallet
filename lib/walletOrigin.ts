/** Origin of the official Organigram passkey wallet. */
export const officialWalletOrigin = 'https://wallet.organigram.ai'
/**
 * Origin of the local copy of the official wallet.
 *
 * @remarks
 * A wallet can have a local copy: the same wallet run on the user's own
 * machine, served under a subdomain of the wallet host, so that it unlocks the
 * same passkeys. An app that trusts the wallet then also trusts that copy.
 * The official wallet's copy is `pnpm dev local-organigram`; another
 * deployment declares its own through `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_LOCAL_URL`.
 */
export const officialLocalWalletOrigin = 'https://local.wallet.organigram.ai:3002'

/** Posted by the local copy's request page as soon as it loads. */
export const passkeyWalletReadyType = 'organigram:wallet:ready'
/** Posted by a wallet before it hands a request to its local copy. */
export const passkeyWalletLocalHandoffType = 'organigram:wallet:local-handoff'
/** Asks a wallet to serve a request itself. */
export const localWalletOptOutParam = 'localWallet'

const localWalletAnswerTimeoutMs = 5000

const parseOrigin = (value: string | undefined): string | null => {
  if (value == null || value.trim() === '') return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const readEnvOrigin = (read: () => string | undefined): string | null =>
  typeof process === 'undefined' ? null : parseOrigin(read())

/** Only an HTTPS subdomain of the wallet host can unlock its passkeys. */
export const isLocalWalletOriginOf = (
  localWalletOrigin: string,
  walletOrigin: string
): boolean => {
  const local = new URL(localWalletOrigin)
  return (
    local.protocol === 'https:' &&
    local.hostname.endsWith(`.${new URL(walletOrigin).hostname}`)
  )
}

/** The local copy of `walletOrigin`, if it has one. */
export const getLocalWalletOrigin = (walletOrigin: string): string | null => {
  const origin = new URL(walletOrigin).origin
  if (origin === officialWalletOrigin) return officialLocalWalletOrigin

  // Next.js inlines these variables only when they are read literally.
  const configuredWallet = readEnvOrigin(
    () => process.env.NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL
  )
  const configuredLocal = readEnvOrigin(
    () => process.env.NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_LOCAL_URL
  )
  return configuredLocal != null &&
    configuredWallet === origin &&
    isLocalWalletOriginOf(configuredLocal, origin)
    ? configuredLocal
    : null
}

/** The origins whose messages an app expecting `walletOrigin` accepts. */
export const getAcceptedWalletOrigins = (walletOrigin: string): string[] => {
  const origin = new URL(walletOrigin).origin
  const local = getLocalWalletOrigin(origin)
  return local == null ? [origin] : [origin, local]
}

const withOrigin = (url: URL, origin: string): URL =>
  new URL(`${url.pathname}${url.search}${url.hash}`, origin)

const preferredOriginKey = (walletOrigin: string): string =>
  `organigram.passkeyWallet.preferredOrigin:${new URL(walletOrigin).origin}`

/**
 * Opens requests on the local copy once it has answered on this device, so
 * that the official wallet is no longer loaded at all.
 */
export const toPreferredWalletUrl = (url: URL): URL => {
  let preferredOrigin: string | null = null
  try {
    preferredOrigin = window.localStorage.getItem(preferredOriginKey(url.origin))
  } catch {}
  if (
    preferredOrigin == null ||
    !getAcceptedWalletOrigins(url.origin).includes(preferredOrigin)
  ) {
    return url
  }
  return withOrigin(url, preferredOrigin)
}

/** Remembers which of the accepted origins answered for `walletOrigin`. */
export const rememberWalletOrigin = (
  walletOrigin: string,
  answeringOrigin: string
): void => {
  try {
    if (answeringOrigin === new URL(walletOrigin).origin) {
      window.localStorage.removeItem(preferredOriginKey(walletOrigin))
    } else {
      window.localStorage.setItem(preferredOriginKey(walletOrigin), answeringOrigin)
    }
  } catch {}
}

/**
 * Sends a message to the wallet popup, whichever accepted origin it shows:
 * the browser only delivers it to the one the popup is on.
 */
export const postToWalletPopup = (
  popup: Window,
  message: unknown,
  walletOrigin: string
): void => {
  for (const origin of getAcceptedWalletOrigins(walletOrigin)) {
    popup.postMessage(message, origin)
  }
}

/**
 * Brings the popup back to the wallet when its local copy does not answer,
 * for instance because it is not running. Returns the cleanup.
 */
export const watchLocalWalletPopup = ({
  popup,
  popupUrl,
  walletOrigin,
  requestId,
  timeoutMs = localWalletAnswerTimeoutMs
}: {
  popup: Window
  popupUrl: URL
  walletOrigin: string
  requestId: string
  timeoutMs?: number
}): (() => void) => {
  const wallet = new URL(walletOrigin).origin
  const local = getAcceptedWalletOrigins(walletOrigin).find(
    origin => origin !== wallet
  )
  if (local == null) return () => undefined

  let timer: number | null = null
  const stopWaiting = (): void => {
    if (timer != null) window.clearTimeout(timer)
    timer = null
  }
  const fallBack = (): void => {
    rememberWalletOrigin(walletOrigin, wallet)
    const walletUrl = withOrigin(popupUrl, wallet)
    walletUrl.searchParams.set(localWalletOptOutParam, 'off')
    if (!popup.closed) popup.location.href = walletUrl.toString()
  }
  const waitForLocal = (): void => {
    stopWaiting()
    timer = window.setTimeout(fallBack, timeoutMs)
  }
  const handleMessage = (event: MessageEvent): void => {
    const data = event.data as { type?: unknown, requestId?: unknown } | null
    if (data?.requestId !== requestId) return
    if (event.origin === wallet && data.type === passkeyWalletLocalHandoffType) {
      waitForLocal()
    } else if (event.origin === local && data.type === passkeyWalletReadyType) {
      stopWaiting()
    }
  }

  window.addEventListener('message', handleMessage)
  if (popupUrl.origin === local) waitForLocal()
  return () => {
    stopWaiting()
    window.removeEventListener('message', handleMessage)
  }
}
