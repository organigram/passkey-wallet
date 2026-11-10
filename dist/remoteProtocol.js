import { getAddress, isAddress, isHex, recoverMessageAddress, recoverTypedDataAddress } from 'viem';
import { parseWalletEncryptedPayload } from './encryption';
import { normalizeHost, requireString } from './protocol';
import { getAcceptedWalletOrigins, postToWalletPopup, rememberWalletOrigin, toPreferredWalletUrl, watchLocalWalletPopup } from './walletOrigin';
/** Type of a request to connect an app to the wallet. */
export const passkeyWalletConnectType = 'organigram:wallet:connect';
/** Type of the answer to a connect request. */
export const passkeyWalletConnectResultType = 'organigram:wallet:connect-result';
/** Type of a request to sign a message. */
export const passkeyWalletSignMessageType = 'organigram:wallet:sign-message';
/** Type of the answer to a sign message request. */
export const passkeyWalletSignMessageResultType = 'organigram:wallet:sign-message-result';
/** Type of a request to sign EIP-712 typed data. */
export const passkeyWalletSignTypedDataType = 'organigram:wallet:sign-typed-data';
/** Type of the answer to a sign typed data request. */
export const passkeyWalletSignTypedDataResultType = 'organigram:wallet:sign-typed-data-result';
/** Type of a request to send a transaction. */
export const passkeyWalletSendTransactionType = 'organigram:wallet:send-transaction';
/** Type of the answer to a send transaction request. */
export const passkeyWalletSendTransactionResultType = 'organigram:wallet:send-transaction-result';
/** Type of a request to encrypt a text with the wallet encryption key. */
export const passkeyWalletEncryptPayloadType = 'organigram:wallet:encrypt-payload';
/** Type of the answer to an encrypt payload request. */
export const passkeyWalletEncryptPayloadResultType = 'organigram:wallet:encrypt-payload-result';
/** Type of a request to decrypt a text with the wallet encryption key. */
export const passkeyWalletDecryptPayloadType = 'organigram:wallet:decrypt-payload';
/** Type of the answer to a decrypt payload request. */
export const passkeyWalletDecryptPayloadResultType = 'organigram:wallet:decrypt-payload-result';
/** Type of the answer to a request the wallet could not serve. */
export const passkeyWalletRemoteErrorResultType = 'organigram:wallet:remote-error';
/** Type of the message by which an app posts a request to the wallet popup. */
export const passkeyWalletRemoteRequestPayloadType = 'organigram:wallet:request-payload';
/**
 * Check that a signed message comes from the expected address and chain.
 *
 * @remarks
 * Recovers the signer from the signature, so that a forged answer is rejected.
 * This only works for EOA signatures, which the wallet produces.
 * @param input - The answer, and the address, chain and message of the request.
 * @throws When the address, chain or signer differs.
 */
export const assertPasskeyWalletSignMessageResult = async ({ result, address, chainId, message }) => {
    const expectedAddress = getAddress(address);
    const resultAddress = getAddress(result.address);
    if (resultAddress !== expectedAddress) {
        throw new Error(`Organigram Wallet returned a signature for ${resultAddress}, expected ${expectedAddress}.`);
    }
    if (result.chainId !== chainId) {
        throw new Error(`Organigram Wallet returned a signature for chain ${result.chainId}, expected ${chainId}.`);
    }
    const recoveredAddress = await recoverMessageAddress({
        message,
        signature: result.signature
    });
    if (getAddress(recoveredAddress) !== expectedAddress) {
        throw new Error(`Organigram Wallet signature recovered ${recoveredAddress}, expected ${expectedAddress}.`);
    }
};
/**
 * Check that signed typed data comes from the expected address and chain.
 *
 * @remarks
 * Recovers the signer from the signature, so that a forged answer is rejected.
 * @param input - The answer, and the address, chain and typed data of the
 * request.
 * @throws When the address, chain or signer differs.
 */
export const assertPasskeyWalletSignTypedDataResult = async ({ result, address, chainId, typedData }) => {
    const expectedAddress = getAddress(address);
    const resultAddress = getAddress(result.address);
    if (resultAddress !== expectedAddress) {
        throw new Error(`Organigram Wallet returned a signature for ${resultAddress}, expected ${expectedAddress}.`);
    }
    if (result.chainId !== chainId) {
        throw new Error(`Organigram Wallet returned a signature for chain ${result.chainId}, expected ${chainId}.`);
    }
    const recoveredAddress = await recoverTypedDataAddress({
        ...typedData,
        signature: result.signature
    });
    if (getAddress(recoveredAddress) !== expectedAddress) {
        throw new Error(`Organigram Wallet typed-data signature recovered ${recoveredAddress}, expected ${expectedAddress}.`);
    }
};
const isRequestDomainOfOrigin = (domain, appOrigin) => {
    try {
        return normalizeHost(domain) === normalizeHost(new URL(appOrigin).host);
    }
    catch {
        return false;
    }
};
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
export const isPasskeyWalletRemoteRequestPayloadMessage = (value, expectedRequestId) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const payload = value;
    if (payload.type !== passkeyWalletRemoteRequestPayloadType ||
        payload.version !== 1 ||
        typeof payload.request !== 'object' ||
        payload.request == null) {
        return false;
    }
    const request = payload.request;
    if (expectedRequestId != null && request.requestId !== expectedRequestId) {
        return false;
    }
    const hasRemoteRequestBase = request.version === 1 &&
        typeof request.requestId === 'string' &&
        typeof request.appOrigin === 'string' &&
        typeof request.domain === 'string' &&
        typeof request.chainId === 'number' &&
        typeof request.requestedAt === 'string';
    if (!hasRemoteRequestBase)
        return false;
    // The domain shown for approval is declared by the requesting page, so it
    // must be its own, as for requests passed in the URL.
    if (!isRequestDomainOfOrigin(request.domain, request.appOrigin)) {
        return false;
    }
    if (request.type === passkeyWalletConnectType)
        return true;
    if (request.type !== passkeyWalletSignMessageType &&
        request.type !== passkeyWalletSignTypedDataType &&
        request.type !== passkeyWalletSendTransactionType &&
        request.type !== passkeyWalletEncryptPayloadType &&
        request.type !== passkeyWalletDecryptPayloadType) {
        return false;
    }
    if (request.type === passkeyWalletSignMessageType) {
        const signMessageRequest = request;
        return (typeof signMessageRequest.address === 'string' &&
            typeof signMessageRequest.message === 'string');
    }
    if (request.type === passkeyWalletSendTransactionType) {
        const transactionRequest = request;
        return (typeof transactionRequest.address === 'string' &&
            isPasskeyWalletTransaction(transactionRequest.transaction));
    }
    if (request.type === passkeyWalletEncryptPayloadType) {
        const encryptPayloadRequest = request;
        return (typeof encryptPayloadRequest.address === 'string' &&
            typeof encryptPayloadRequest.plaintext === 'string');
    }
    if (request.type === passkeyWalletDecryptPayloadType) {
        const decryptPayloadRequest = request;
        if (typeof decryptPayloadRequest.address !== 'string')
            return false;
        try {
            parseWalletEncryptedPayload(decryptPayloadRequest.encryptedPayload);
            return true;
        }
        catch {
            return false;
        }
    }
    const signTypedDataRequest = request;
    return (typeof signTypedDataRequest.address === 'string' &&
        isPasskeyWalletTypedData(signTypedDataRequest.typedData));
};
/**
 * Serialize typed data in JSON, writing bigints as decimal strings.
 *
 * @param typedData - The typed data.
 */
export const stringifyPasskeyWalletTypedData = (typedData) => JSON.stringify(typedData, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
/**
 * Read typed data.
 *
 * @param value - The typed data, or its JSON.
 * @throws When the value is not typed data.
 */
export const parsePasskeyWalletTypedData = (value) => {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!isPasskeyWalletTypedData(parsed)) {
        throw new Error('Organigram wallet expected EIP-712 typed data.');
    }
    return parsed;
};
const isPasskeyWalletTypedData = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const typedData = value;
    return (typeof typedData.domain === 'object' &&
        typedData.domain != null &&
        typeof typedData.types === 'object' &&
        typedData.types != null &&
        typeof typedData.primaryType === 'string' &&
        typeof typedData.message === 'object' &&
        typedData.message != null);
};
/**
 * Check that a value is a transaction with valid addresses and hex quantities.
 *
 * @param value - The value to check.
 */
export const isPasskeyWalletTransaction = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const transaction = value;
    if (!isAddress(transaction.from ?? '') || !isAddress(transaction.to ?? '')) {
        return false;
    }
    return [
        'data',
        'value',
        'gas',
        'gasPrice',
        'maxFeePerGas',
        'maxPriorityFeePerGas',
        'nonce'
    ].every(key => {
        const field = transaction[key];
        return field == null || (typeof field === 'string' && isHex(field));
    });
};
const defaultWalletOrigin = 'https://localhost:3002';
const getConfiguredWalletOrigin = () => typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL?.trim() || undefined
    : undefined;
const requireHttpsOrigin = (value, field) => {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
        throw new Error(`Organigram wallet ${field} must use HTTPS.`);
    }
    return url;
};
const requireAddress = (value, field) => {
    const address = requireString(value, field);
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`Organigram wallet ${field} must be an Ethereum address.`);
    }
    return address;
};
const requireChainId = (value) => {
    const chainId = Number(requireString(value, 'chainId'));
    if (!Number.isSafeInteger(chainId) || chainId <= 0) {
        throw new Error('Organigram wallet chainId must be a positive integer.');
    }
    return chainId;
};
const createRequestId = () => {
    if (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};
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
export const buildPasskeyWalletRemotePopupUrl = ({ walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin, appOrigin = window.location.origin, type, chainId, requestId = createRequestId(), requestedAt = new Date().toISOString(), address, approvalStep, approvalCount, approvalLabel }) => {
    const normalizedAppOrigin = requireHttpsOrigin(appOrigin, 'appOrigin').origin;
    const popupUrl = requireHttpsOrigin(walletOrigin, 'walletOrigin');
    popupUrl.pathname = '/request';
    popupUrl.searchParams.set('type', type);
    popupUrl.searchParams.set('version', '1');
    popupUrl.searchParams.set('requestId', requestId);
    popupUrl.searchParams.set('appOrigin', normalizedAppOrigin);
    popupUrl.searchParams.set('domain', new URL(normalizedAppOrigin).host);
    popupUrl.searchParams.set('chainId', chainId.toString());
    popupUrl.searchParams.set('requestedAt', requestedAt);
    if (approvalStep != null && approvalCount != null) {
        popupUrl.searchParams.set('approvalStep', approvalStep.toString());
        popupUrl.searchParams.set('approvalCount', approvalCount.toString());
        if (approvalLabel != null && approvalLabel !== '') {
            popupUrl.searchParams.set('approvalLabel', approvalLabel);
        }
    }
    if (address != null)
        popupUrl.searchParams.set('address', address);
    // Every request other than connect is delivered by postMessage. The wallet
    // then reads the requesting origin from the browser-authenticated
    // MessageEvent instead of trusting the appOrigin written in this URL, and
    // no message, transaction or secret lands in a URL.
    if (type !== passkeyWalletConnectType) {
        popupUrl.searchParams.set('messageTransport', 'post-message');
    }
    return popupUrl;
};
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
export const parsePasskeyWalletRemoteRequest = (params) => {
    const type = requireString(params.get('type'), 'type');
    if (type !== passkeyWalletConnectType &&
        type !== passkeyWalletSignMessageType &&
        type !== passkeyWalletSignTypedDataType &&
        type !== passkeyWalletSendTransactionType &&
        type !== passkeyWalletEncryptPayloadType &&
        type !== passkeyWalletDecryptPayloadType) {
        throw new Error('Unsupported Organigram wallet remote request type.');
    }
    if (type === passkeyWalletEncryptPayloadType ||
        type === passkeyWalletDecryptPayloadType) {
        throw new Error('Encrypted payload requests must be delivered by postMessage.');
    }
    const version = Number(requireString(params.get('version'), 'version'));
    if (version !== 1) {
        throw new Error('Unsupported Organigram wallet remote request version.');
    }
    const appOrigin = requireHttpsOrigin(requireString(params.get('appOrigin'), 'appOrigin'), 'appOrigin').origin;
    const domain = normalizeHost(requireString(params.get('domain'), 'domain'));
    if (domain !== normalizeHost(new URL(appOrigin).host)) {
        throw new Error('Organigram wallet request domain must match appOrigin.');
    }
    const approvalStep = params.get('approvalStep');
    const approvalCount = params.get('approvalCount');
    const parsedApprovalStep = approvalStep == null ? undefined : Number.parseInt(approvalStep, 10);
    const parsedApprovalCount = approvalCount == null ? undefined : Number.parseInt(approvalCount, 10);
    if ((parsedApprovalStep == null) !== (parsedApprovalCount == null) ||
        (parsedApprovalStep != null &&
            (parsedApprovalCount == null ||
                !Number.isSafeInteger(parsedApprovalStep) ||
                !Number.isSafeInteger(parsedApprovalCount) ||
                parsedApprovalStep < 1 ||
                parsedApprovalCount < parsedApprovalStep))) {
        throw new Error('Invalid Organigram wallet approval sequence.');
    }
    const base = {
        version: 1,
        requestId: requireString(params.get('requestId'), 'requestId'),
        appOrigin,
        domain,
        chainId: requireChainId(params.get('chainId')),
        requestedAt: requireString(params.get('requestedAt'), 'requestedAt'),
        ...(parsedApprovalStep == null
            ? {}
            : {
                approvalStep: parsedApprovalStep,
                approvalCount: parsedApprovalCount,
                ...(params.get('approvalLabel') == null
                    ? {}
                    : { approvalLabel: params.get('approvalLabel') })
            })
    };
    if (type === passkeyWalletConnectType) {
        return {
            ...base,
            type: passkeyWalletConnectType
        };
    }
    if (type === passkeyWalletSignMessageType) {
        return {
            ...base,
            type: passkeyWalletSignMessageType,
            address: requireAddress(params.get('address'), 'address'),
            message: requireString(params.get('message'), 'message')
        };
    }
    if (type === passkeyWalletSendTransactionType) {
        const address = requireAddress(params.get('address'), 'address');
        const transaction = JSON.parse(requireString(params.get('transaction'), 'transaction'));
        if (!isPasskeyWalletTransaction(transaction) ||
            getAddress(transaction.from) !== getAddress(address)) {
            throw new Error('Invalid Organigram wallet transaction request.');
        }
        return {
            ...base,
            type: passkeyWalletSendTransactionType,
            address,
            transaction
        };
    }
    return {
        ...base,
        type: passkeyWalletSignTypedDataType,
        address: requireAddress(params.get('address'), 'address'),
        typedData: parsePasskeyWalletTypedData(params.get('typedData'))
    };
};
const requestPasskeyWalletRemoteResult = async ({ popupUrl, requestId, expectedResultType, timeoutMs, requestPayload }) => {
    const configuredOrigin = popupUrl.origin;
    const acceptedOrigins = getAcceptedWalletOrigins(configuredOrigin);
    const preferredPopupUrl = toPreferredWalletUrl(popupUrl);
    const popup = window.open(preferredPopupUrl.toString(), 'passkey-wallet', 'popup,width=480,height=720');
    if (popup == null) {
        throw new Error('Unable to open Organigram Passkey Wallet popup.');
    }
    const openedPopup = popup;
    return await new Promise((resolve, reject) => {
        const stopWatchingLocalWallet = watchLocalWalletPopup({
            popup,
            popupUrl: preferredPopupUrl,
            walletOrigin: configuredOrigin,
            requestId
        });
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('Organigram Passkey Wallet request timed out.'));
        }, timeoutMs);
        const payloadTimer = requestPayload == null
            ? null
            : window.setInterval(() => {
                postToWalletPopup(popup, requestPayload, configuredOrigin);
            }, 250);
        const cleanup = () => {
            window.clearTimeout(timeout);
            if (payloadTimer != null)
                window.clearInterval(payloadTimer);
            stopWatchingLocalWallet();
            window.removeEventListener('message', handleMessage);
        };
        function handleMessage(event) {
            if (!acceptedOrigins.includes(event.origin))
                return;
            const data = event.data;
            if (data == null ||
                data.type !== expectedResultType ||
                data.version !== 1 ||
                data.requestId !== requestId ||
                typeof data.address !== 'string' ||
                typeof data.chainId !== 'number') {
                return;
            }
            cleanup();
            rememberWalletOrigin(configuredOrigin, event.origin);
            openedPopup.close();
            resolve(data);
        }
        if (requestPayload != null) {
            postToWalletPopup(popup, requestPayload, configuredOrigin);
        }
        window.addEventListener('message', handleMessage);
    });
};
const createPostMessagePayload = (request) => ({
    type: passkeyWalletRemoteRequestPayloadType,
    version: 1,
    request
});
/**
 * Ask the wallet, in a popup, to encrypt a text for the origin of the app.
 *
 * @param input - The request, the address, the text, and a timeout, 5 minutes
 * by default.
 * @returns The answer, with the encrypted payload.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export const requestPasskeyWalletEncryptPayload = async ({ timeoutMs = 5 * 60 * 1000, plaintext, ...input }) => {
    const requestId = input.requestId ?? createRequestId();
    const popupUrl = buildPasskeyWalletRemotePopupUrl({
        ...input,
        type: passkeyWalletEncryptPayloadType,
        requestId
    });
    const request = {
        type: passkeyWalletEncryptPayloadType,
        version: 1,
        requestId,
        appOrigin: popupUrl.searchParams.get('appOrigin') ?? '',
        domain: popupUrl.searchParams.get('domain') ?? '',
        chainId: input.chainId,
        requestedAt: popupUrl.searchParams.get('requestedAt') ?? '',
        address: input.address,
        plaintext
    };
    return await requestPasskeyWalletRemoteResult({
        popupUrl,
        requestId,
        expectedResultType: passkeyWalletEncryptPayloadResultType,
        timeoutMs,
        requestPayload: createPostMessagePayload(request)
    });
};
/**
 * Ask the wallet, in a popup, to decrypt a text encrypted for the origin of the
 * app.
 *
 * @param input - The request, the address, the encrypted payload, and a
 * timeout, 5 minutes by default.
 * @returns The answer, with the decrypted text.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export const requestPasskeyWalletDecryptPayload = async ({ timeoutMs = 5 * 60 * 1000, encryptedPayload, ...input }) => {
    const requestId = input.requestId ?? createRequestId();
    const popupUrl = buildPasskeyWalletRemotePopupUrl({
        ...input,
        type: passkeyWalletDecryptPayloadType,
        requestId
    });
    const request = {
        type: passkeyWalletDecryptPayloadType,
        version: 1,
        requestId,
        appOrigin: popupUrl.searchParams.get('appOrigin') ?? '',
        domain: popupUrl.searchParams.get('domain') ?? '',
        chainId: input.chainId,
        requestedAt: popupUrl.searchParams.get('requestedAt') ?? '',
        address: input.address,
        encryptedPayload
    };
    return await requestPasskeyWalletRemoteResult({
        popupUrl,
        requestId,
        expectedResultType: passkeyWalletDecryptPayloadResultType,
        timeoutMs,
        requestPayload: createPostMessagePayload(request)
    });
};
/**
 * Ask the wallet, in a popup, to connect the app.
 *
 * @param input - The request, and a timeout, 5 minutes by default.
 * @returns The answer, with the address the user selected.
 * @throws When the popup cannot be opened or the user does not answer in time.
 */
export const requestPasskeyWalletConnect = async ({ timeoutMs = 5 * 60 * 1000, ...input }) => {
    const requestId = input.requestId ?? createRequestId();
    const popupUrl = buildPasskeyWalletRemotePopupUrl({
        ...input,
        type: passkeyWalletConnectType,
        requestId
    });
    return await requestPasskeyWalletRemoteResult({
        popupUrl,
        requestId,
        expectedResultType: passkeyWalletConnectResultType,
        timeoutMs
    });
};
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
export const requestPasskeyWalletSignMessage = async ({ timeoutMs = 5 * 60 * 1000, message, ...input }) => {
    const requestId = input.requestId ?? createRequestId();
    const popupUrl = buildPasskeyWalletRemotePopupUrl({
        ...input,
        type: passkeyWalletSignMessageType,
        requestId
    });
    const request = {
        type: passkeyWalletSignMessageType,
        version: 1,
        requestId,
        appOrigin: popupUrl.searchParams.get('appOrigin') ?? '',
        domain: popupUrl.searchParams.get('domain') ?? '',
        chainId: input.chainId,
        requestedAt: popupUrl.searchParams.get('requestedAt') ?? '',
        address: input.address,
        message
    };
    const result = await requestPasskeyWalletRemoteResult({
        popupUrl,
        requestId,
        expectedResultType: passkeyWalletSignMessageResultType,
        timeoutMs,
        requestPayload: createPostMessagePayload(request)
    });
    await assertPasskeyWalletSignMessageResult({
        result,
        address: input.address,
        chainId: input.chainId,
        message
    });
    return result;
};
