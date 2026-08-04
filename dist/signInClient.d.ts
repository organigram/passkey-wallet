import { type PasskeyWalletSignInResult } from './signInProtocol';
export type PasskeyWalletPopupInput = {
    walletOrigin?: string;
    appOrigin?: string;
    nonce: string;
    chainId: number;
    requestId?: string;
    requestedAt?: string;
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
export type SignInWithPasskeyWalletInput = {
    chainId?: number;
    walletOrigin?: string;
    getCsrfToken: () => Promise<string | null | undefined>;
    requestWalletSignIn?: (input: WalletSignInInput) => Promise<PasskeyWalletSignInResult>;
    submitCredentials?: SubmitCredentials;
};
export declare const passkeyWalletStackSessionChangedType = "organigram:wallet:stack-session-changed";
export type PasskeyWalletStackSessionChangedMessage = {
    type: typeof passkeyWalletStackSessionChangedType;
    version: 1;
    event: 'revoked';
    appOrigin: string;
    address: `0x${string}` | null;
};
export declare const parsePasskeyWalletStackSessionChangedMessage: (value: unknown) => PasskeyWalletStackSessionChangedMessage | null;
export declare const createPasskeyWalletStackSessionChangedMessage: ({ event, appOrigin, address }: {
    event: "revoked";
    appOrigin: string;
    address?: `0x${string}` | null;
}) => PasskeyWalletStackSessionChangedMessage;
export declare const notifyPasskeyWalletStackSessionChanged: ({ event, appOrigin, address, targetOrigin }: {
    event: "revoked";
    appOrigin: string;
    address?: `0x${string}` | null;
    targetOrigin?: string;
}) => void;
export declare const buildPasskeyWalletSignInPopupUrl: ({ walletOrigin, appOrigin, nonce, chainId, requestId, requestedAt }: PasskeyWalletPopupInput) => URL;
export declare const requestPasskeyWalletSignIn: ({ nonce, chainId, popup: preparedPopup, walletOrigin, timeoutMs }: PasskeyWalletPopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletSignInResult>;
export declare const submitPasskeyWalletCredentials: SubmitCredentials;
export declare const notifyCurrentTabNextAuthSessionChanged: () => void;
export declare const signInWithPasskeyWallet: ({ chainId, walletOrigin, getCsrfToken, requestWalletSignIn, submitCredentials }: SignInWithPasskeyWalletInput) => Promise<PasskeyWalletSignInResult>;
export {};
