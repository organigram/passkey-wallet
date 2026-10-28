import { type WalletEncryptedPayload } from './encryption';
export declare const passkeyWalletConnectType = "organigram:wallet:connect";
export declare const passkeyWalletConnectResultType = "organigram:wallet:connect-result";
export declare const passkeyWalletSignMessageType = "organigram:wallet:sign-message";
export declare const passkeyWalletSignMessageResultType = "organigram:wallet:sign-message-result";
export declare const passkeyWalletSignTypedDataType = "organigram:wallet:sign-typed-data";
export declare const passkeyWalletSignTypedDataResultType = "organigram:wallet:sign-typed-data-result";
export declare const passkeyWalletSendTransactionType = "organigram:wallet:send-transaction";
export declare const passkeyWalletSendTransactionResultType = "organigram:wallet:send-transaction-result";
export declare const passkeyWalletEncryptPayloadType = "organigram:wallet:encrypt-payload";
export declare const passkeyWalletEncryptPayloadResultType = "organigram:wallet:encrypt-payload-result";
export declare const passkeyWalletDecryptPayloadType = "organigram:wallet:decrypt-payload";
export declare const passkeyWalletDecryptPayloadResultType = "organigram:wallet:decrypt-payload-result";
export declare const passkeyWalletRemoteErrorResultType = "organigram:wallet:remote-error";
export declare const passkeyWalletRemoteRequestPayloadType = "organigram:wallet:request-payload";
export type PasskeyWalletRemoteRequestType = typeof passkeyWalletConnectType | typeof passkeyWalletSignMessageType | typeof passkeyWalletSignTypedDataType | typeof passkeyWalletSendTransactionType | typeof passkeyWalletEncryptPayloadType | typeof passkeyWalletDecryptPayloadType;
type PasskeyWalletRemoteRequestBase = {
    type: PasskeyWalletRemoteRequestType;
    version: 1;
    requestId: string;
    appOrigin: string;
    domain: string;
    chainId: number;
    requestedAt: string;
    /**
     * Optional context for a sequence of wallet approvals initiated by the app.
     * It is informational only and never changes what the wallet signs.
     */
    approvalStep?: number;
    approvalCount?: number;
    approvalLabel?: string;
};
export type PasskeyWalletConnectRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletConnectType;
};
export type PasskeyWalletSignMessageRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSignMessageType;
    address: `0x${string}`;
    message: string;
};
export type PasskeyWalletTypedData = {
    domain: Record<string, unknown>;
    types: Record<string, ReadonlyArray<{
        name: string;
        type: string;
    }>>;
    primaryType: string;
    message: Record<string, unknown>;
};
export type PasskeyWalletSignTypedDataRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSignTypedDataType;
    address: `0x${string}`;
    typedData: PasskeyWalletTypedData;
};
export type PasskeyWalletTransaction = {
    from: `0x${string}`;
    to: `0x${string}`;
    data?: `0x${string}`;
    value?: `0x${string}`;
    gas?: `0x${string}`;
    gasPrice?: `0x${string}`;
    maxFeePerGas?: `0x${string}`;
    maxPriorityFeePerGas?: `0x${string}`;
    nonce?: `0x${string}`;
};
export type PasskeyWalletSendTransactionRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSendTransactionType;
    address: `0x${string}`;
    transaction: PasskeyWalletTransaction;
};
export type PasskeyWalletEncryptPayloadRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletEncryptPayloadType;
    address: `0x${string}`;
    plaintext: string;
};
export type PasskeyWalletDecryptPayloadRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletDecryptPayloadType;
    address: `0x${string}`;
    encryptedPayload: WalletEncryptedPayload;
};
export type PasskeyWalletRemoteRequest = PasskeyWalletConnectRequest | PasskeyWalletSignMessageRequest | PasskeyWalletSignTypedDataRequest | PasskeyWalletSendTransactionRequest | PasskeyWalletEncryptPayloadRequest | PasskeyWalletDecryptPayloadRequest;
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
export type PasskeyWalletSignTypedDataResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSignTypedDataResultType;
    typedData: PasskeyWalletTypedData;
    signature: `0x${string}`;
};
export type PasskeyWalletSendTransactionResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSendTransactionResultType;
    transactionHash: `0x${string}`;
};
export type PasskeyWalletEncryptPayloadResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletEncryptPayloadResultType;
    encryptedPayload: WalletEncryptedPayload;
};
export type PasskeyWalletDecryptPayloadResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletDecryptPayloadResultType;
    plaintext: string;
};
export type PasskeyWalletRemoteErrorResult = Omit<PasskeyWalletRemoteResultBase, 'address'> & {
    type: typeof passkeyWalletRemoteErrorResultType;
    address?: undefined;
    error: string;
};
export type PasskeyWalletRemoteResult = PasskeyWalletConnectResult | PasskeyWalletSignMessageResult | PasskeyWalletSignTypedDataResult | PasskeyWalletSendTransactionResult | PasskeyWalletEncryptPayloadResult | PasskeyWalletDecryptPayloadResult | PasskeyWalletRemoteErrorResult;
export type PasskeyWalletRemoteRequestPayloadMessage = {
    type: typeof passkeyWalletRemoteRequestPayloadType;
    version: 1;
    request: PasskeyWalletRemoteRequest;
};
export type PasskeyWalletRemotePopupInput = {
    walletOrigin?: string;
    appOrigin?: string;
    chainId: number;
    requestId?: string;
    requestedAt?: string;
    approvalStep?: number;
    approvalCount?: number;
    approvalLabel?: string;
};
export type PasskeyWalletConnectPopupInput = PasskeyWalletRemotePopupInput;
export type PasskeyWalletSignMessagePopupInput = PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    message: string;
};
export type PasskeyWalletSignTypedDataPopupInput = PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    typedData: PasskeyWalletTypedData;
};
export declare const assertPasskeyWalletSignMessageResult: ({ result, address, chainId, message }: {
    result: PasskeyWalletSignMessageResult;
    address: `0x${string}`;
    chainId: number;
    message: string;
}) => Promise<void>;
export declare const assertPasskeyWalletSignTypedDataResult: ({ result, address, chainId, typedData }: {
    result: PasskeyWalletSignTypedDataResult;
    address: `0x${string}`;
    chainId: number;
    typedData: PasskeyWalletTypedData;
}) => Promise<void>;
export declare const isPasskeyWalletRemoteRequestPayloadMessage: (value: unknown, expectedRequestId?: string) => value is PasskeyWalletRemoteRequestPayloadMessage;
export declare const stringifyPasskeyWalletTypedData: (typedData: PasskeyWalletTypedData) => string;
export declare const parsePasskeyWalletTypedData: (value: unknown) => PasskeyWalletTypedData;
export declare const isPasskeyWalletTransaction: (value: unknown) => value is PasskeyWalletTransaction;
export declare const buildPasskeyWalletRemotePopupUrl: ({ walletOrigin, appOrigin, type, chainId, requestId, requestedAt, address, approvalStep, approvalCount, approvalLabel }: PasskeyWalletRemotePopupInput & {
    type: PasskeyWalletRemoteRequestType;
    address?: `0x${string}`;
}) => URL;
export declare const parsePasskeyWalletRemoteRequest: (params: URLSearchParams) => PasskeyWalletRemoteRequest;
export declare const requestPasskeyWalletEncryptPayload: ({ timeoutMs, plaintext, ...input }: PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    plaintext: string;
    timeoutMs?: number;
}) => Promise<PasskeyWalletEncryptPayloadResult>;
export declare const requestPasskeyWalletDecryptPayload: ({ timeoutMs, encryptedPayload, ...input }: PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    encryptedPayload: WalletEncryptedPayload;
    timeoutMs?: number;
}) => Promise<PasskeyWalletDecryptPayloadResult>;
export declare const requestPasskeyWalletConnect: ({ timeoutMs, ...input }: PasskeyWalletConnectPopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletConnectResult>;
export declare const requestPasskeyWalletSignMessage: ({ timeoutMs, message, ...input }: PasskeyWalletSignMessagePopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletSignMessageResult>;
export {};
