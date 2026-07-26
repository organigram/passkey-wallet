import type { Chain } from 'viem';
import { type PasskeyWalletVerifiedSiwe } from './server';
export type PasskeyWalletNextAuthCredentials = {
    message?: unknown;
    signature?: unknown;
    csrfToken?: unknown;
};
export type AuthorizePasskeyWalletCredentialsInput = {
    credentials: PasskeyWalletNextAuthCredentials | undefined;
    domain: string;
    nonce: string | null | undefined;
    chain?: Chain;
    transportUrl: string;
    transportOptions?: Parameters<typeof import('viem').http>[1];
};
export declare const authorizePasskeyWalletCredentials: ({ chain, credentials, domain, nonce, transportOptions, transportUrl }: AuthorizePasskeyWalletCredentialsInput) => Promise<PasskeyWalletVerifiedSiwe | null>;
