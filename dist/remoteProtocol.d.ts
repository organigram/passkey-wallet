import { type WalletEncryptedPayload } from './encryption';
/** Type of a request to connect an app to the wallet. */
export declare const passkeyWalletConnectType = "organigram:wallet:connect";
/** Type of the answer to a connect request. */
export declare const passkeyWalletConnectResultType = "organigram:wallet:connect-result";
/** Type of a request to sign a message. */
export declare const passkeyWalletSignMessageType = "organigram:wallet:sign-message";
/** Type of the answer to a sign message request. */
export declare const passkeyWalletSignMessageResultType = "organigram:wallet:sign-message-result";
/** Type of a request to sign EIP-712 typed data. */
export declare const passkeyWalletSignTypedDataType = "organigram:wallet:sign-typed-data";
/** Type of the answer to a sign typed data request. */
export declare const passkeyWalletSignTypedDataResultType = "organigram:wallet:sign-typed-data-result";
/** Type of a request to send a transaction. */
export declare const passkeyWalletSendTransactionType = "organigram:wallet:send-transaction";
/** Type of the answer to a send transaction request. */
export declare const passkeyWalletSendTransactionResultType = "organigram:wallet:send-transaction-result";
/** Type of a request to encrypt a text with the wallet encryption key. */
export declare const passkeyWalletEncryptPayloadType = "organigram:wallet:encrypt-payload";
/** Type of the answer to an encrypt payload request. */
export declare const passkeyWalletEncryptPayloadResultType = "organigram:wallet:encrypt-payload-result";
/** Type of a request to decrypt a text with the wallet encryption key. */
export declare const passkeyWalletDecryptPayloadType = "organigram:wallet:decrypt-payload";
/** Type of the answer to a decrypt payload request. */
export declare const passkeyWalletDecryptPayloadResultType = "organigram:wallet:decrypt-payload-result";
/** Type of the answer to a request the wallet could not serve. */
export declare const passkeyWalletRemoteErrorResultType = "organigram:wallet:remote-error";
/** Type of the message by which an app posts a request to the wallet popup. */
export declare const passkeyWalletRemoteRequestPayloadType = "organigram:wallet:request-payload";
/** Types of the requests an app can send to the wallet. */
export type PasskeyWalletRemoteRequestType = typeof passkeyWalletConnectType | typeof passkeyWalletSignMessageType | typeof passkeyWalletSignTypedDataType | typeof passkeyWalletSendTransactionType | typeof passkeyWalletEncryptPayloadType | typeof passkeyWalletDecryptPayloadType;
type PasskeyWalletRemoteRequestBase = {
    /** Type of the request. */
    type: PasskeyWalletRemoteRequestType;
    /** Version of the protocol. */
    version: 1;
    /** Identifier of the request, repeated in the answer. */
    requestId: string;
    /** Origin of the app sending the request. */
    appOrigin: string;
    /** Host of the app, shown to the user for approval. */
    domain: string;
    /** Chain of the request. */
    chainId: number;
    /** ISO 8601 date of the request. */
    requestedAt: string;
    /**
     * Optional context for a sequence of wallet approvals initiated by the app.
     * It is informational only and never changes what the wallet signs.
     */
    approvalStep?: number;
    approvalCount?: number;
    approvalLabel?: string;
};
/**
 * A request to connect an app to the wallet, which answers with the selected
 * address.
 */
export type PasskeyWalletConnectRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletConnectType;
};
/** A request to sign a message with EIP-191 `personal_sign`. */
export type PasskeyWalletSignMessageRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSignMessageType;
    /** Address to sign with. */
    address: `0x${string}`;
    /** Message to sign. */
    message: string;
};
/** EIP-712 typed data. */
export type PasskeyWalletTypedData = {
    /** EIP-712 domain. */
    domain: Record<string, unknown>;
    /** Type definitions. */
    types: Record<string, ReadonlyArray<{
        name: string;
        type: string;
    }>>;
    /** Type of the message. */
    primaryType: string;
    /** The message. */
    message: Record<string, unknown>;
};
/** A request to sign EIP-712 typed data. */
export type PasskeyWalletSignTypedDataRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSignTypedDataType;
    /** Address to sign with. */
    address: `0x${string}`;
    /** Typed data to sign. */
    typedData: PasskeyWalletTypedData;
};
/** A transaction to send, with quantities in hex. */
export type PasskeyWalletTransaction = {
    /** Sender, the address of the request. */
    from: `0x${string}`;
    /** Recipient. */
    to: `0x${string}`;
    /** Call data. */
    data?: `0x${string}`;
    /** Value in wei. */
    value?: `0x${string}`;
    /** Gas limit. */
    gas?: `0x${string}`;
    /** Gas price of a legacy transaction. */
    gasPrice?: `0x${string}`;
    /** EIP-1559 maximum fee per gas. */
    maxFeePerGas?: `0x${string}`;
    /** EIP-1559 maximum priority fee per gas. */
    maxPriorityFeePerGas?: `0x${string}`;
    /** Nonce of the sender. */
    nonce?: `0x${string}`;
};
/** A request to sign and send a transaction. */
export type PasskeyWalletSendTransactionRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletSendTransactionType;
    /** Address to send from. */
    address: `0x${string}`;
    /** Transaction to send. */
    transaction: PasskeyWalletTransaction;
};
/**
 * A request to encrypt a text with the wallet encryption key, for the origin of
 * the app.
 */
export type PasskeyWalletEncryptPayloadRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletEncryptPayloadType;
    /** Address of the wallet. */
    address: `0x${string}`;
    /** Text to encrypt. */
    plaintext: string;
};
/** A request to decrypt a text encrypted for the origin of the app. */
export type PasskeyWalletDecryptPayloadRequest = PasskeyWalletRemoteRequestBase & {
    type: typeof passkeyWalletDecryptPayloadType;
    /** Address of the wallet. */
    address: `0x${string}`;
    /** Payload to decrypt. */
    encryptedPayload: WalletEncryptedPayload;
};
/** A request an app can send to the wallet. */
export type PasskeyWalletRemoteRequest = PasskeyWalletConnectRequest | PasskeyWalletSignMessageRequest | PasskeyWalletSignTypedDataRequest | PasskeyWalletSendTransactionRequest | PasskeyWalletEncryptPayloadRequest | PasskeyWalletDecryptPayloadRequest;
type PasskeyWalletRemoteResultBase = {
    /** Version of the protocol. */
    version: 1;
    /** Identifier of the request. */
    requestId: string;
    /** Host of the app. */
    domain: string;
    /** Address of the wallet that answered. */
    address: `0x${string}`;
    /** Chain of the request. */
    chainId: number;
    /** ISO 8601 date of the answer. */
    completedAt: string;
};
/** The answer to a connect request, with the address the user selected. */
export type PasskeyWalletConnectResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletConnectResultType;
};
/** The answer to a sign message request. */
export type PasskeyWalletSignMessageResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSignMessageResultType;
    /** Message signed. */
    message: string;
    /** Signature. */
    signature: `0x${string}`;
};
/** The answer to a sign typed data request. */
export type PasskeyWalletSignTypedDataResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSignTypedDataResultType;
    /** Typed data signed. */
    typedData: PasskeyWalletTypedData;
    /** Signature. */
    signature: `0x${string}`;
};
/** The answer to a send transaction request. */
export type PasskeyWalletSendTransactionResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletSendTransactionResultType;
    /** Hash of the transaction sent. */
    transactionHash: `0x${string}`;
};
/** The answer to an encrypt payload request. */
export type PasskeyWalletEncryptPayloadResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletEncryptPayloadResultType;
    /**
     * Encrypted payload, which only this wallet can decrypt for the origin of
     * the app.
     */
    encryptedPayload: WalletEncryptedPayload;
};
/** The answer to a decrypt payload request. */
export type PasskeyWalletDecryptPayloadResult = PasskeyWalletRemoteResultBase & {
    type: typeof passkeyWalletDecryptPayloadResultType;
    /** Decrypted text. */
    plaintext: string;
};
/** The answer to a request the wallet could not serve. */
export type PasskeyWalletRemoteErrorResult = Omit<PasskeyWalletRemoteResultBase, 'address'> & {
    type: typeof passkeyWalletRemoteErrorResultType;
    address?: undefined;
    /** Description of the error. */
    error: string;
};
/** An answer of the wallet to a request. */
export type PasskeyWalletRemoteResult = PasskeyWalletConnectResult | PasskeyWalletSignMessageResult | PasskeyWalletSignTypedDataResult | PasskeyWalletSendTransactionResult | PasskeyWalletEncryptPayloadResult | PasskeyWalletDecryptPayloadResult | PasskeyWalletRemoteErrorResult;
/** The message by which an app posts a request to the wallet popup. */
export type PasskeyWalletRemoteRequestPayloadMessage = {
    /** Always `passkeyWalletRemoteRequestPayloadType`. */
    type: typeof passkeyWalletRemoteRequestPayloadType;
    /** Version of the protocol. */
    version: 1;
    /** The request. */
    request: PasskeyWalletRemoteRequest;
};
/** Common input of the requests to the wallet popup. */
export type PasskeyWalletRemotePopupInput = {
    /**
     * HTTPS origin of the wallet, `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL` or
     * `https://localhost:3002` by default.
     */
    walletOrigin?: string;
    /** HTTPS origin of the app, the current origin by default. */
    appOrigin?: string;
    /** Chain of the request. */
    chainId: number;
    /** Identifier of the request, random by default. */
    requestId?: string;
    /** ISO 8601 date of the request, now by default. */
    requestedAt?: string;
    /**
     * Rank of this request in a sequence of approvals, from 1, shown to the user.
     */
    approvalStep?: number;
    /** Number of approvals of the sequence. */
    approvalCount?: number;
    /** Label of the sequence. */
    approvalLabel?: string;
};
/** Input of `requestPasskeyWalletConnect()`. */
export type PasskeyWalletConnectPopupInput = PasskeyWalletRemotePopupInput;
/** Input of `requestPasskeyWalletSignMessage()`. */
export type PasskeyWalletSignMessagePopupInput = PasskeyWalletRemotePopupInput & {
    /** Address to sign with. */
    address: `0x${string}`;
    /** Message to sign. */
    message: string;
};
/** Input of a request to sign typed data. */
export type PasskeyWalletSignTypedDataPopupInput = PasskeyWalletRemotePopupInput & {
    /** Address to sign with. */
    address: `0x${string}`;
    /** Typed data to sign. */
    typedData: PasskeyWalletTypedData;
};
/**
 * Check that a signed message comes from the expected address and chain.
 *
 * @remarks
 * Recovers the signer from the signature, so that a forged answer is rejected.
 * This only works for EOA signatures, which the wallet produces.
 * @param input - The answer, and the address, chain and message of the request.
 * @throws When the address, chain or signer differs.
 */
export declare const assertPasskeyWalletSignMessageResult: ({ result, address, chainId, message }: {
    result: PasskeyWalletSignMessageResult;
    address: `0x${string}`;
    chainId: number;
    message: string;
}) => Promise<void>;
/**
 * Check that signed typed data comes from the expected address and chain.
 *
 * @remarks
 * Recovers the signer from the signature, so that a forged answer is rejected.
 * @param input - The answer, and the address, chain and typed data of the
 * request.
 * @throws When the address, chain or signer differs.
 */
export declare const assertPasskeyWalletSignTypedDataResult: ({ result, address, chainId, typedData }: {
    result: PasskeyWalletSignTypedDataResult;
    address: `0x${string}`;
    chainId: number;
    typedData: PasskeyWalletTypedData;
}) => Promise<void>;
/**
 * Check that a posted message is a valid request to the wallet.
 *
 * @remarks
 * The domain of the request must be the host of its `appOrigin`. The wallet
 * must still compare `appOrigin` with the origin of the `MessageEvent`, which
 * the browser authenticates.
 * @param value - The data of the message.
 * @param expectedRequestId - The identifier of the expected request, if known.
 */
export declare const isPasskeyWalletRemoteRequestPayloadMessage: (value: unknown, expectedRequestId?: string) => value is PasskeyWalletRemoteRequestPayloadMessage;
/**
 * Serialize typed data in JSON, writing bigints as decimal strings.
 *
 * @param typedData - The typed data.
 */
export declare const stringifyPasskeyWalletTypedData: (typedData: PasskeyWalletTypedData) => string;
/**
 * Read typed data.
 *
 * @param value - The typed data, or its JSON.
 * @throws When the value is not typed data.
 */
export declare const parsePasskeyWalletTypedData: (value: unknown) => PasskeyWalletTypedData;
/**
 * Check that a value is a transaction with valid addresses and hex quantities.
 *
 * @param value - The value to check.
 */
export declare const isPasskeyWalletTransaction: (value: unknown) => value is PasskeyWalletTransaction;
/**
 * Build the URL of the wallet popup for a request.
 *
 * @remarks
 * Every request other than connect is then delivered by `postMessage`. The
 * wallet reads the requesting origin from the browser-authenticated
 * `MessageEvent` instead of trusting the `appOrigin` written in the URL, and no
 * message, transaction or secret lands in a URL.
 * @param input - The request, with its type and address.
 * @throws When the wallet or app origin does not use HTTPS.
 */
export declare const buildPasskeyWalletRemotePopupUrl: ({ walletOrigin, appOrigin, type, chainId, requestId, requestedAt, address, approvalStep, approvalCount, approvalLabel }: PasskeyWalletRemotePopupInput & {
    type: PasskeyWalletRemoteRequestType;
    address?: `0x${string}`;
}) => URL;
/**
 * Read and check a request from the URL parameters of the wallet popup.
 *
 * @remarks
 * Rejects encrypt and decrypt requests, which must be delivered by
 * `postMessage`, and requests whose domain is not the host of their
 * `appOrigin`.
 * @param params - The URL parameters.
 * @throws When the request is invalid or of an unsupported type or version.
 */
export declare const parsePasskeyWalletRemoteRequest: (params: URLSearchParams) => PasskeyWalletRemoteRequest;
/**
 * Ask the wallet, in a popup, to encrypt a text for the origin of the app.
 *
 * @param input - The request, the address, the text, and a timeout, 5 minutes
 * by default.
 * @returns The answer, with the encrypted payload.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export declare const requestPasskeyWalletEncryptPayload: ({ timeoutMs, plaintext, ...input }: PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    plaintext: string;
    timeoutMs?: number;
}) => Promise<PasskeyWalletEncryptPayloadResult>;
/**
 * Ask the wallet, in a popup, to decrypt a text encrypted for the origin of the
 * app.
 *
 * @param input - The request, the address, the encrypted payload, and a
 * timeout, 5 minutes by default.
 * @returns The answer, with the decrypted text.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export declare const requestPasskeyWalletDecryptPayload: ({ timeoutMs, encryptedPayload, ...input }: PasskeyWalletRemotePopupInput & {
    address: `0x${string}`;
    encryptedPayload: WalletEncryptedPayload;
    timeoutMs?: number;
}) => Promise<PasskeyWalletDecryptPayloadResult>;
/**
 * Ask the wallet, in a popup, to connect the app.
 *
 * @param input - The request, and a timeout, 5 minutes by default.
 * @returns The answer, with the address the user selected.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export declare const requestPasskeyWalletConnect: ({ timeoutMs, ...input }: PasskeyWalletConnectPopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletConnectResult>;
/**
 * Ask the wallet, in a popup, to sign a message.
 *
 * @remarks
 * The answer is checked with `assertPasskeyWalletSignMessageResult()`.
 * @param input - The request, the address, the message, and a timeout, 5
 * minutes by default.
 * @returns The answer, with the signature.
 * @throws When the popup cannot be opened, the user does not answer in time, or
 * the signature is not valid.
 */
export declare const requestPasskeyWalletSignMessage: ({ timeoutMs, message, ...input }: PasskeyWalletSignMessagePopupInput & {
    timeoutMs?: number;
}) => Promise<PasskeyWalletSignMessageResult>;
export {};
