/** Type of a sign-in request to the wallet. */
export declare const passkeyWalletSignInType = "organigram:wallet:sign-in";
/** Type of the message answering a sign-in request. */
export declare const passkeyWalletSignInResultType = "organigram:wallet:sign-in-result";
/** Type of the message answering a request the wallet could not serve. */
export declare const passkeyWalletErrorType = "organigram:wallet:error";
/**
 * A request to sign in to an app with the wallet, read from the URL of the
 * wallet popup.
 */
export type PasskeyWalletSignInRequest = {
    /** Always `passkeyWalletSignInType`. */
    type: typeof passkeyWalletSignInType;
    /** Version of the protocol. */
    version: 1;
    /** Identifier of the request, repeated in the answer. */
    requestId: string;
    /** Host of the app asking to sign in. */
    domain: string;
    /**
     * HTTPS URL, on the domain of the app, from which the wallet fetches the
     * Sign-In with Ethereum message to sign.
     */
    challengeUrl: string;
    /**
     * HTTPS URL to return to after signing in, when the wallet is not in a popup.
     */
    returnUrl?: string;
    /** ISO 8601 date of the request. */
    requestedAt: string;
};
/**
 * The answer of the wallet to a sign-in request: a signed Sign-In with Ethereum
 * message.
 */
export type PasskeyWalletSignInResult = {
    /** Always `passkeyWalletSignInResultType`. */
    type: typeof passkeyWalletSignInResultType;
    /** Version of the protocol. */
    version: 1;
    /** Identifier of the request. */
    requestId: string;
    /** Host of the app. */
    domain: string;
    /** Address that signed in. */
    address: `0x${string}`;
    /** Sign-In with Ethereum message. */
    message: string;
    /** Signature of the message. */
    signature: `0x${string}`;
    /** ISO 8601 date of the signature. */
    completedAt: string;
};
/** The answer of the wallet to a request it could not serve. */
export type PasskeyWalletErrorResult = {
    /** Always `passkeyWalletErrorType`. */
    type: typeof passkeyWalletErrorType;
    /** Version of the protocol. */
    version: 1;
    /** Identifier of the request. */
    requestId: string;
    /** Reason of the error. */
    code: 'user_rejected' | 'challenge_unavailable' | 'domain_mismatch' | 'wallet_locked' | 'unsupported_origin' | 'internal_error';
    /** Description of the error. */
    message: string;
};
/** How an app accepts sign-ins with the wallet. */
export type PasskeyWalletManifest = {
    /** Version of the manifest. */
    version: 1;
    /** Host of the app. */
    domain: string;
    /**
     * HTTPS URL, on the domain of the app, that issues Sign-In with Ethereum
     * messages.
     */
    signInChallengeUrl: string;
    /** HTTPS URL, on the domain of the app, to complete the sign-in. */
    signInCompletionUrl?: string;
};
/**
 * Read and check a sign-in request from the URL parameters of the wallet popup.
 *
 * @remarks
 * The challenge URL must use HTTPS and belong to the requested domain or one of
 * its subdomains, and the return URL must use HTTPS, so that the wallet only
 * signs messages fetched from the app asking for them.
 * @param params - The URL parameters.
 * @throws When the request is invalid or of an unsupported type or version.
 */
export declare const parsePasskeyWalletSignInRequest: (params: URLSearchParams) => PasskeyWalletSignInRequest;
/**
 * Check the manifest of an app.
 *
 * @remarks
 * The domain of the manifest must be the host serving it, and its URLs must use
 * HTTPS and belong to that domain or its subdomains.
 * @param manifest - The manifest, parsed from JSON.
 * @param servingHost - The host the manifest was fetched from.
 * @throws When the manifest is invalid.
 */
export declare const validatePasskeyWalletManifest: (manifest: unknown, servingHost: string) => PasskeyWalletManifest;
/**
 * Read the domain of a Sign-In with Ethereum message from its first line.
 *
 * @param message - The message.
 * @throws When the first line is not a Sign-In with Ethereum header.
 */
export declare const resolveSiweDomain: (message: string) => string;
/**
 * Check that a Sign-In with Ethereum message is for the expected domain, before
 * signing it.
 *
 * @param message - The message.
 * @param expectedDomain - The domain of the request.
 * @throws When the domains differ.
 */
export declare const assertSignInDomainMatches: (message: string, expectedDomain: string) => void;
