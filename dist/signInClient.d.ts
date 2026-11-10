import { type PasskeyWalletSignInResult } from './signInProtocol';
/** Input of a sign-in request through the wallet popup. */
export type PasskeyWalletPopupInput = {
    /**
     * Origin of the wallet, `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL` or
     * `https://localhost:3002` by default.
     */
    walletOrigin?: string;
    /** Origin of the app, the current origin by default. */
    appOrigin?: string;
    /** Nonce of the Sign-In with Ethereum message, issued by the app. */
    nonce: string;
    /** Chain of the message. */
    chainId: number;
    /** Identifier of the request, random by default. */
    requestId?: string;
    /** ISO 8601 date of the request, now by default. */
    requestedAt?: string;
    /**
     * A popup opened beforehand, for example synchronously on a click so that the
     * browser does not block it.
     */
    popup?: Window | null;
};
type SignInResult = {
    ok?: boolean;
    error?: string | null;
    status?: number;
};
type SignInOptions = {
    csrfToken: string;
    message: string;
    redirect: false;
    signature: string;
};
type SubmitCredentials = (options: SignInOptions) => Promise<SignInResult | undefined>;
type WalletSignInInput = {
    nonce: string;
    chainId: number;
    walletOrigin?: string;
    popup?: Window | null;
};
/** Input of `signInWithPasskeyWallet()`. */
export type SignInWithPasskeyWalletInput = {
    /** Chain of the message, Sepolia (11155111) by default. */
    chainId?: number;
    /** Origin of the wallet. */
    walletOrigin?: string;
    /**
     * Get the CSRF token of the NextAuth session, used as the nonce of the
     * message.
     */
    getCsrfToken: () => Promise<string | null | undefined>;
    /** Ask the wallet to sign in, `requestPasskeyWalletSignIn()` by default. */
    requestWalletSignIn?: (input: WalletSignInInput) => Promise<PasskeyWalletSignInResult>;
    /**
     * Submit the signed message to the app, `submitPasskeyWalletCredentials()` by
     * default.
     */
    submitCredentials?: SubmitCredentials;
};
/**
 * Type of the message telling an app that its session changed in the wallet.
 */
export declare const passkeyWalletStackSessionChangedType = "organigram:wallet:stack-session-changed";
/**
 * A message posted by the wallet to the app that opened it when the user
 * revokes the session of that app.
 */
export type PasskeyWalletStackSessionChangedMessage = {
    /** Always `passkeyWalletStackSessionChangedType`. */
    type: typeof passkeyWalletStackSessionChangedType;
    /** Version of the protocol. */
    version: 1;
    /** What changed: the session was revoked. */
    event: 'revoked';
    /** Origin of the app. */
    appOrigin: string;
    /** Address of the session, if known. */
    address: `0x${string}` | null;
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
export declare const parsePasskeyWalletStackSessionChangedMessage: (value: unknown) => PasskeyWalletStackSessionChangedMessage | null;
/**
 * Create a session change message.
 *
 * @param input - The event, the origin of the app and the address of the
 * session.
 * @throws When the origin or address is invalid.
 */
export declare const createPasskeyWalletStackSessionChangedMessage: ({ event, appOrigin, address }: {
    event: "revoked";
    appOrigin: string;
    address?: `0x${string}` | null;
}) => PasskeyWalletStackSessionChangedMessage;
/**
 * Post a session change message to the window that opened the wallet.
 *
 * @param input - The event, the origin of the app, the address of the session,
 * and the origin to post to, the app origin by default.
 */
export declare const notifyPasskeyWalletStackSessionChanged: ({ event, appOrigin, address, targetOrigin }: {
    event: "revoked";
    appOrigin: string;
    address?: `0x${string}` | null;
    targetOrigin?: string;
}) => void;
/**
 * Build the URL of the wallet popup for a sign-in request, with the challenge
 * URL `/api/auth/wallet/challenge` of the app.
 *
 * @param input - The sign-in request.
 */
export declare const buildPasskeyWalletSignInPopupUrl: ({ walletOrigin, appOrigin, nonce, chainId, requestId, requestedAt }: PasskeyWalletPopupInput) => URL;
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
export declare const requestPasskeyWalletSignIn: ({ nonce, chainId, popup: preparedPopup, walletOrigin, timeoutMs }: PasskeyWalletPopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletSignInResult>;
/**
 * Submit a signed message to the NextAuth credentials callback of the app, at
 * `/api/auth/callback/credentials`.
 */
export declare const submitPasskeyWalletCredentials: SubmitCredentials;
/**
 * Tell NextAuth in the current tab that the session changed, so that it reloads
 * it.
 */
export declare const notifyCurrentTabNextAuthSessionChanged: () => void;
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
export declare const signInWithPasskeyWallet: ({ chainId, walletOrigin, getCsrfToken, requestWalletSignIn, submitCredentials }: SignInWithPasskeyWalletInput) => Promise<PasskeyWalletSignInResult>;
export {};
