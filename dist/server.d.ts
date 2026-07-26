import { http, type Chain, type Hex } from 'viem';
import { type WalletEncryptionPublicKeySiweResource } from './encryption';
export type PasskeyWalletManifest = {
    version: 1;
    domain: string;
    signInChallengeUrl: string;
    signInCompletionUrl?: string;
};
export type PasskeyWalletChallenge = {
    domain: string;
    nonce: string;
    issuedAt: string;
    expiresAt: string;
    message: string;
};
export type PasskeyWalletVerifiedSiwe = {
    address: `0x${string}`;
    chainId: number;
    domain: string;
    uri: string;
    nonce: string;
    encryptionPublicKeyResource: WalletEncryptionPublicKeySiweResource | null;
};
export type PasskeyWalletVerifySiweInput = {
    message: string;
    signature: Hex;
    domain: string;
    nonce: string;
    chain?: Chain;
    transportUrl: string;
    transportOptions?: Parameters<typeof http>[1];
};
export declare const getPasskeyWalletRequestOrigin: (request: Request) => string;
export declare const createPasskeyWalletManifest: (request: Request) => PasskeyWalletManifest;
export declare const getPasskeyWalletCorsAllowedOrigins: ({ allowedOrigins, request, walletUrl }: {
    request: Request;
    walletUrl?: string;
    allowedOrigins?: string;
}) => string[];
export declare const getPasskeyWalletCorsOrigin: ({ allowedOrigins, request, walletUrl }: {
    request: Request;
    walletUrl?: string;
    allowedOrigins?: string;
}) => string | null;
export declare const withPasskeyWalletCorsHeaders: <Response extends {
    headers: Headers;
}>(request: Request, response: Response, options?: {
    allowedMethods?: string;
    walletUrl?: string;
    allowedOrigins?: string;
}) => Response;
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
export declare const buildPasskeyWalletPopupUrl: ({ challengeUrl, domain, requestId, requestedAt, returnUrl, walletOrigin }: {
    walletOrigin: string;
    domain: string;
    challengeUrl: string;
    requestId?: string;
    requestedAt?: string;
    returnUrl?: string;
}) => URL;
export declare const isWalletSignInOriginAllowed: (origin: string, allowedOrigins: readonly string[]) => boolean;
export declare const verifyPasskeyWalletSiwe: ({ chain, domain, message, nonce, signature, transportOptions, transportUrl }: PasskeyWalletVerifySiweInput) => Promise<PasskeyWalletVerifiedSiwe | null>;
