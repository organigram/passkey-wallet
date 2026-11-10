import { passkeyWalletSignInResultType, passkeyWalletSignInType } from './signInProtocol';
import { getAcceptedWalletOrigins, rememberWalletOrigin, toPreferredWalletUrl, watchLocalWalletPopup } from './walletOrigin';
/**
 * Type of the message telling an app that its session changed in the wallet.
 */
export const passkeyWalletStackSessionChangedType = 'organigram:wallet:stack-session-changed';
const defaultWalletOrigin = 'https://localhost:3002';
const getConfiguredWalletOrigin = () => typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL?.trim() || undefined
    : undefined;
const createRequestId = () => {
    if (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};
const normalizeOrigin = (value) => {
    if (typeof value !== 'string' || value.trim() === '')
        return null;
    try {
        return new URL(value).origin;
    }
    catch {
        return null;
    }
};
const parseOptionalAddress = (value) => {
    if (value == null)
        return null;
    if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return null;
    }
    return value;
};
/**
 * Read a session change message.
 *
 * @remarks
 * Also check the origin of the `MessageEvent` carrying it: only trust messages
 * from the wallet.
 * @param value - The data of the message.
 * @returns The message, or `null` if it is invalid.
 */
export const parsePasskeyWalletStackSessionChangedMessage = (value) => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const message = value;
    if (message.type !== passkeyWalletStackSessionChangedType ||
        message.version !== 1 ||
        message.event !== 'revoked') {
        return null;
    }
    const appOrigin = normalizeOrigin(message.appOrigin);
    if (appOrigin == null)
        return null;
    const address = parseOptionalAddress(message.address);
    if (message.address != null && address == null)
        return null;
    return {
        type: passkeyWalletStackSessionChangedType,
        version: 1,
        event: 'revoked',
        appOrigin,
        address
    };
};
/**
 * Create a session change message.
 *
 * @param input - The event, the origin of the app and the address of the
 * session.
 * @throws When the origin or address is invalid.
 */
export const createPasskeyWalletStackSessionChangedMessage = ({ event, appOrigin, address }) => {
    const message = parsePasskeyWalletStackSessionChangedMessage({
        type: passkeyWalletStackSessionChangedType,
        version: 1,
        event,
        appOrigin,
        address: address ?? null
    });
    if (message == null) {
        throw new Error('Invalid Organigram stack session change message.');
    }
    return message;
};
/**
 * Post a session change message to the window that opened the wallet.
 *
 * @param input - The event, the origin of the app, the address of the session,
 * and the origin to post to, the app origin by default.
 */
export const notifyPasskeyWalletStackSessionChanged = ({ event, appOrigin, address, targetOrigin = appOrigin }) => {
    if (typeof window === 'undefined')
        return;
    const normalizedTargetOrigin = normalizeOrigin(targetOrigin);
    if (normalizedTargetOrigin == null)
        return;
    const message = createPasskeyWalletStackSessionChangedMessage({
        event,
        appOrigin,
        address
    });
    window.opener?.postMessage(message, normalizedTargetOrigin);
};
/**
 * Build the URL of the wallet popup for a sign-in request, with the challenge
 * URL `/api/auth/wallet/challenge` of the app.
 *
 * @param input - The sign-in request.
 */
export const buildPasskeyWalletSignInPopupUrl = ({ walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin, appOrigin = window.location.origin, nonce, chainId, requestId = createRequestId(), requestedAt = new Date().toISOString() }) => {
    const normalizedAppOrigin = new URL(appOrigin).origin;
    const challengeUrl = new URL('/api/auth/wallet/challenge', normalizedAppOrigin);
    challengeUrl.searchParams.set('nonce', nonce);
    challengeUrl.searchParams.set('chainId', chainId.toString());
    const popupUrl = new URL(walletOrigin);
    popupUrl.pathname = '/request';
    popupUrl.searchParams.set('type', passkeyWalletSignInType);
    popupUrl.searchParams.set('version', '1');
    popupUrl.searchParams.set('requestId', requestId);
    popupUrl.searchParams.set('domain', new URL(normalizedAppOrigin).host);
    popupUrl.searchParams.set('challengeUrl', challengeUrl.toString());
    popupUrl.searchParams.set('requestedAt', requestedAt);
    return popupUrl;
};
/**
 * Ask the wallet, in a popup, to sign a Sign-In with Ethereum message for the
 * app.
 *
 * @remarks
 * Only accepts answers from the wallet origin and its local copy, for this
 * request. The result is not verified: the server must verify it with
 * `verifyPasskeyWalletSiwe()`.
 * @param input - The sign-in request, and a timeout, 5 minutes by default.
 * @returns The signed message.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export const requestPasskeyWalletSignIn = async ({ nonce, chainId, popup: preparedPopup, walletOrigin, timeoutMs = 5 * 60 * 1000 }) => {
    const requestId = createRequestId();
    const configuredPopupUrl = buildPasskeyWalletSignInPopupUrl({
        walletOrigin,
        nonce,
        chainId,
        requestId
    });
    const configuredOrigin = configuredPopupUrl.origin;
    const acceptedOrigins = getAcceptedWalletOrigins(configuredOrigin);
    const popupUrl = toPreferredWalletUrl(configuredPopupUrl);
    const popup = preparedPopup ??
        window.open(popupUrl.toString(), 'passkey-wallet-sign-in', 'popup,width=480,height=720');
    if (popup == null) {
        throw new Error('Unable to open Organigram Passkey Wallet popup.');
    }
    const openedPopup = popup;
    if (preparedPopup != null) {
        openedPopup.location.href = popupUrl.toString();
        openedPopup.focus();
    }
    return await new Promise((resolve, reject) => {
        const stopWatchingLocalWallet = watchLocalWalletPopup({
            popup: openedPopup,
            popupUrl,
            walletOrigin: configuredOrigin,
            requestId
        });
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('Organigram Passkey Wallet sign-in timed out.'));
        }, timeoutMs);
        const cleanup = () => {
            window.clearTimeout(timeout);
            stopWatchingLocalWallet();
            window.removeEventListener('message', handleMessage);
        };
        function handleMessage(event) {
            if (!acceptedOrigins.includes(event.origin))
                return;
            const data = event.data;
            if (data == null ||
                data.type !== passkeyWalletSignInResultType ||
                data.version !== 1 ||
                data.requestId !== requestId ||
                typeof data.message !== 'string' ||
                typeof data.signature !== 'string' ||
                typeof data.address !== 'string') {
                return;
            }
            cleanup();
            rememberWalletOrigin(configuredOrigin, event.origin);
            openedPopup.close();
            resolve(data);
        }
        window.addEventListener('message', handleMessage);
    });
};
/**
 * Submit a signed message to the NextAuth credentials callback of the app, at
 * `/api/auth/callback/credentials`.
 */
export const submitPasskeyWalletCredentials = async ({ csrfToken, message, signature }) => {
    const response = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            csrfToken,
            message,
            redirect: 'false',
            signature,
            callbackUrl: window.location.href,
            json: 'true'
        })
    });
    const body = (await response.json().catch(() => null));
    const error = typeof body?.url === 'string'
        ? new URL(body.url, window.location.origin).searchParams.get('error')
        : null;
    if (response.ok) {
        notifyCurrentTabNextAuthSessionChanged();
    }
    return {
        error,
        status: response.status,
        ok: response.ok
    };
};
const nextAuthSessionStorageEventKey = 'nextauth.message';
/**
 * Tell NextAuth in the current tab that the session changed, so that it reloads
 * it.
 */
export const notifyCurrentTabNextAuthSessionChanged = () => {
    if (typeof window === 'undefined')
        return;
    const newValue = JSON.stringify({
        event: 'session',
        data: { trigger: 'getSession' },
        timestamp: Math.floor(Date.now() / 1000)
    });
    try {
        window.localStorage.setItem(nextAuthSessionStorageEventKey, newValue);
    }
    catch {
        // Local storage can be unavailable in hardened browser modes.
    }
    if (typeof StorageEvent === 'function') {
        window.dispatchEvent(new StorageEvent('storage', {
            key: nextAuthSessionStorageEventKey,
            newValue
        }));
        return;
    }
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: nextAuthSessionStorageEventKey });
    Object.defineProperty(event, 'newValue', { value: newValue });
    window.dispatchEvent(event);
};
const openPasskeyWalletPopupShell = () => {
    if (typeof window === 'undefined')
        return undefined;
    return window.open('', 'passkey-wallet-sign-in', 'popup,width=480,height=720');
};
/**
 * Sign in to a NextAuth app with the wallet.
 *
 * @remarks
 * Opens the wallet popup, uses the CSRF token as the nonce of the Sign-In with
 * Ethereum message, and submits the signed message to the NextAuth credentials
 * provider, which verifies it with `authorizePasskeyWalletCredentials()`.
 * @param input - The CSRF token getter, the chain and the wallet origin.
 * @returns The signed message.
 * @throws When the CSRF token is missing or the sign-in fails.
 * @example
 * ```ts
 * import { getCsrfToken } from 'next-auth/react'
 *
 * await signInWithPasskeyWallet({ getCsrfToken })
 * ```
 */
export const signInWithPasskeyWallet = async ({ chainId = 11155111, walletOrigin, getCsrfToken, requestWalletSignIn = requestPasskeyWalletSignIn, submitCredentials = submitPasskeyWalletCredentials }) => {
    const popup = requestWalletSignIn === requestPasskeyWalletSignIn
        ? openPasskeyWalletPopupShell()
        : undefined;
    const nonce = await getCsrfToken();
    if (nonce == null || nonce === '') {
        popup?.close();
        throw new Error('Missing CSRF token');
    }
    const walletResult = await requestWalletSignIn({
        nonce,
        chainId,
        walletOrigin,
        popup
    }).catch(error => {
        popup?.close();
        throw error;
    });
    const signInResult = await submitCredentials({
        csrfToken: nonce,
        message: walletResult.message,
        redirect: false,
        signature: walletResult.signature
    });
    if (signInResult?.ok !== true || signInResult.error != null) {
        throw new Error(signInResult?.error ?? 'Failed to login');
    }
    notifyCurrentTabNextAuthSessionChanged();
    return walletResult;
};
