export declare const passkeyWalletSignInType = "organigram:wallet:sign-in";
export declare const passkeyWalletSignInResultType = "organigram:wallet:sign-in-result";
export declare const passkeyWalletErrorType = "organigram:wallet:error";
export type PasskeyWalletSignInRequest = {
    type: typeof passkeyWalletSignInType;
    version: 1;
    requestId: string;
    domain: string;
    challengeUrl: string;
    returnUrl?: string;
    requestedAt: string;
};
export type PasskeyWalletSignInResult = {
    type: typeof passkeyWalletSignInResultType;
    version: 1;
    requestId: string;
    domain: string;
    address: `0x${string}`;
    message: string;
    signature: `0x${string}`;
    completedAt: string;
};
export type PasskeyWalletErrorResult = {
    type: typeof passkeyWalletErrorType;
    version: 1;
    requestId: string;
    code: 'user_rejected' | 'challenge_unavailable' | 'domain_mismatch' | 'wallet_locked' | 'unsupported_origin' | 'internal_error';
    message: string;
};
export type PasskeyWalletManifest = {
    version: 1;
    domain: string;
    signInChallengeUrl: string;
    signInCompletionUrl?: string;
};
export declare const parsePasskeyWalletSignInRequest: (params: URLSearchParams) => PasskeyWalletSignInRequest;
export declare const validatePasskeyWalletManifest: (manifest: unknown, servingHost: string) => PasskeyWalletManifest;
export declare const resolveSiweDomain: (message: string) => string;
export declare const assertSignInDomainMatches: (message: string, expectedDomain: string) => void;
