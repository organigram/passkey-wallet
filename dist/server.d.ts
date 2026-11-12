import { http, type Chain, type Hex } from 'viem';
import { type WalletEncryptionPublicKeySiweResource } from './encryption';
import type { PasskeyWalletManifest } from './signInProtocol';
export type { PasskeyWalletManifest } from './signInProtocol';
/** A Sign-In with Ethereum message issued by an app for the wallet to sign. */
export type PasskeyWalletChallenge = {
    /** Host of the app. */
    domain: string;
    /** Nonce of the message, to check when verifying it. */
    nonce: string;
    /** ISO 8601 date of issue. */
    issuedAt: string;
    /** ISO 8601 date of expiry, 5 minutes after issue. */
    expiresAt: string;
    /** The message to sign. */
    message: string;
};
/** A verified Sign-In with Ethereum message. */
export type PasskeyWalletVerifiedSiwe = {
    /** Address that signed in. */
    address: `0x${string}`;
    /** Chain of the message. */
    chainId: number;
    /** Domain of the message. */
    domain: string;
    /** URI of the message. */
    uri: string;
    /** Nonce of the message. */
    nonce: string;
    /** Public encryption key of the wallet, if the message carries it. */
    encryptionPublicKeyResource: WalletEncryptionPublicKeySiweResource | null;
};
/** Input of `verifyPasskeyWalletSiwe()`. */
export type PasskeyWalletVerifySiweInput = {
    /** The signed message. */
    message: string;
    /** Its signature. */
    signature: Hex;
    /** Domain the message must be for, the host of the app. */
    domain: string;
    /** Nonce the message must carry, as issued by the app. */
    nonce: string;
    /** Chain of the RPC endpoint. */
    chain?: Chain;
    /**
     * URL of an RPC endpoint, used to verify signatures of smart contract
     * accounts.
     */
    transportUrl: string;
    /** Options of the viem HTTP transport. */
    transportOptions?: Parameters<typeof http>[1];
};
/**
 * Get the public origin of a request, from the `X-Forwarded-Host` and
 * `X-Forwarded-Proto` headers when present.
 *
 * @remarks
 * Clients can set these headers. Only rely on the result behind a proxy that
 * overwrites them.
 * @param request - The request.
 */
export declare const getPasskeyWalletRequestOrigin: (request: Request) => string;
/**
 * Create the manifest of an app, with the challenge URL
 * `/api/auth/wallet/challenge` on the origin of the request.
 *
 * @param request - The request for the manifest.
 */
export declare const createPasskeyWalletManifest: (request: Request) => PasskeyWalletManifest;
/**
 * List the wallet origins allowed to call the sign-in endpoints of an app.
 *
 * @remarks
 * Allows the official wallet and its local copy, the configured wallet and its
 * local copy, other configured origins, and, when the app runs on localhost,
 * the wallet served on port 3002 of the same host.
 * @param input - The request, the URL of the configured wallet, and other
 * allowed origins, separated by commas.
 */
export declare const getPasskeyWalletCorsAllowedOrigins: ({ allowedOrigins, request, walletUrl }: {
    request: Request;
    walletUrl?: string;
    allowedOrigins?: string;
}) => string[];
/**
 * Get the origin of a request if it is an allowed wallet origin.
 *
 * @param input - The request, the URL of the configured wallet, and other
 * allowed origins, separated by commas.
 * @returns The origin, or `null`.
 */
export declare const getPasskeyWalletCorsOrigin: ({ allowedOrigins, request, walletUrl }: {
    request: Request;
    walletUrl?: string;
    allowedOrigins?: string;
}) => string | null;
/**
 * Add CORS headers with credentials to a response, if the request comes from an
 * allowed wallet origin.
 *
 * @param request - The request.
 * @param response - The response, returned with its headers changed.
 * @param options - Allowed methods, `GET, OPTIONS` by default, the URL of the
 * configured wallet, and other allowed origins.
 */
export declare const withPasskeyWalletCorsHeaders: <Response extends {
    headers: Headers;
}>(request: Request, response: Response, options?: {
    allowedMethods?: string;
    walletUrl?: string;
    allowedOrigins?: string;
}) => Response;
/**
 * Create a Sign-In with Ethereum message for an address, valid for 5 minutes.
 *
 * @remarks
 * Store the nonce on the server, for example in the session, and check it with
 * `verifyPasskeyWalletSiwe()`.
 * @param input - The request, the address and chain, and optionally the public
 * key resource from `createWalletEncryptionPublicKeySiweResource()`, a nonce,
 * the current date, a statement and the URI of the app, the origin of the
 * request by default.
 * @throws When the address is not valid.
 */
export declare const createPasskeyWalletChallenge: ({ address, chainId, encryptionPublicKeyResource, nonce, now, request, statement, uri }: {
    request: Request;
    address: `0x${string}`;
    chainId: number;
    encryptionPublicKeyResource?: string;
    nonce?: string;
    now?: Date;
    statement?: string;
    uri?: string;
}) => PasskeyWalletChallenge;
/**
 * Build the URL of the wallet popup for a sign-in request.
 *
 * @param input - The origin of the wallet, the domain of the app, its challenge
 * URL, and optionally the request identifier, date and return URL.
 */
export declare const buildPasskeyWalletPopupUrl: ({ challengeUrl, domain, requestId, requestedAt, returnUrl, walletOrigin }: {
    walletOrigin: string;
    domain: string;
    challengeUrl: string;
    requestId?: string;
    requestedAt?: string;
    returnUrl?: string;
}) => URL;
/**
 * Check whether an origin is one of a list of allowed origins.
 *
 * @param origin - The origin to check.
 * @param allowedOrigins - The allowed origins.
 */
export declare const isWalletSignInOriginAllowed: (origin: string, allowedOrigins: readonly string[]) => boolean;
/**
 * Verify a Sign-In with Ethereum message signed by the wallet.
 *
 * @remarks
 * Checks the signature, the domain, the nonce and the validity dates of the
 * message with viem. Never pass an empty domain or nonce: viem then skips
 * their check. Check that the nonce is the one the app issued for this
 * session, and use it only once.
 * @param input - The message, signature, expected domain and nonce, and an RPC
 * endpoint.
 * @returns The verified sign-in, or `null` if the message is invalid.
 * @example
 * ```ts
 * const verified = await verifyPasskeyWalletSiwe({
 *   message,
 *   signature,
 *   domain: 'app.example.com',
 *   nonce: session.nonce,
 *   transportUrl: rpcUrl
 * })
 * ```
 */
export declare const verifyPasskeyWalletSiwe: ({ chain, domain, message, nonce, signature, transportOptions, transportUrl }: PasskeyWalletVerifySiweInput) => Promise<PasskeyWalletVerifiedSiwe | null>;
