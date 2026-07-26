export declare const passkeyWalletConnectType = "organigram:wallet:connect";
export declare const passkeyWalletConnectResultType = "organigram:wallet:connect-result";
export declare const passkeyWalletSignMessageType = "organigram:wallet:sign-message";
export declare const passkeyWalletSignMessageResultType = "organigram:wallet:sign-message-result";
export declare const passkeyWalletDisconnectType = "organigram:wallet:disconnect";
export type PasskeyWalletRemoteRequestType = typeof passkeyWalletConnectType | typeof passkeyWalletSignMessageType | typeof passkeyWalletDisconnectType;
type PasskeyWalletRemoteRequestBase = {
    type: PasskeyWalletRemoteRequestType;
    version: 1;
    requestId: string;
    appOrigin: string;
    domain: string;
    chainId: number;
    requestedAt: string;
};
export type PasskeyWalletConnectRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletConnectType;
};
export type PasskeyWalletSignMessageRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSignMessageType;
    address: `0x${string}`;
    message: string;
};
export type PasskeyWalletRemoteRequest = PasskeyWalletConnectRequest | PasskeyWalletSignMessageRequest;
export type PasskeyWalletDisconnectRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletDisconnectType;
    address: `0x${string}`;
};
type PasskeyWalletRemoteResultBase = {
    version: 1;
    requestId: string;
    domain: string;
    address: `0x${string}`;
    chainId: number;
    completedAt: string;
};
export type PasskeyWalletConnectResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletConnectResultType;
};
export type PasskeyWalletSignMessageResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSignMessageResultType;
    message: string;
    signature: `0x${string}`;
};
export type PasskeyWalletRemoteResult = PasskeyWalletConnectResult | PasskeyWalletSignMessageResult;
export type PasskeyWalletRemotePopupInput = {
    walletOrigin?: string;
    appOrigin?: string;
    chainId: number;
    requestId?: string;
    requestedAt?: string;
};
export type PasskeyWalletConnectPopupInput = PasskeyWalletRemotePopupInput;
export type PasskeyWalletSignMessagePopupInput = PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    message: string;
};
export declare const buildPasskeyWalletRemotePopupUrl: ({ walletOrigin, appOrigin, type, chainId, requestId, requestedAt, address, message }: PasskeyWalletRemotePopupInput & {
    type: PasskeyWalletRemoteRequestType;
    address?: `0x${string}`;
    message?: string;
}) => URL;
export declare const buildPasskeyWalletDisconnectUrl: ({ walletOrigin, appOrigin, chainId, requestId, requestedAt, address }: PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
}) => URL;
export declare const parsePasskeyWalletRemoteRequest: (params: URLSearchParams) => PasskeyWalletRemoteRequest;
export declare const parsePasskeyWalletDisconnectRequest: (params: URLSearchParams) => PasskeyWalletDisconnectRequest;
export declare const requestPasskeyWalletConnect: ({ timeoutMs, ...input }: PasskeyWalletConnectPopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletConnectResult>;
export declare const requestPasskeyWalletSignMessage: ({ timeoutMs, ...input }: PasskeyWalletSignMessagePopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletSignMessageResult>;
export {};
