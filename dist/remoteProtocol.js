import { normalizeHost, requireString } from './protocol';
export const passkeyWalletConnectType = 'organigram:wallet:connect';
export const passkeyWalletConnectResultType = 'organigram:wallet:connect-result';
export const passkeyWalletSignMessageType = 'organigram:wallet:sign-message';
export const passkeyWalletSignMessageResultType = 'organigram:wallet:sign-message-result';
export const passkeyWalletDisconnectType = 'organigram:wallet:disconnect';
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
export const buildPasskeyWalletRemotePopupUrl = ({ walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin, appOrigin = window.location.origin, type, chainId, requestId = createRequestId(), requestedAt = new Date().toISOString(), address, message }) => {
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
    if (address != null)
        popupUrl.searchParams.set('address', address);
    if (message != null)
        popupUrl.searchParams.set('message', message);
    return popupUrl;
};
export const buildPasskeyWalletDisconnectUrl = ({ walletOrigin = getConfiguredWalletOrigin() ?? defaultWalletOrigin, appOrigin = window.location.origin, chainId, requestId = createRequestId(), requestedAt = new Date().toISOString(), address }) => buildPasskeyWalletRemotePopupUrl({
    walletOrigin,
    appOrigin,
    type: passkeyWalletDisconnectType,
    chainId,
    requestId,
    requestedAt,
    address
});
export const parsePasskeyWalletRemoteRequest = (params) => {
    const type = requireString(params.get('type'), 'type');
    if (type !== passkeyWalletConnectType &&
        type !== passkeyWalletSignMessageType) {
        throw new Error('Unsupported Organigram wallet remote request type.');
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
    const base = {
        version: 1,
        requestId: requireString(params.get('requestId'), 'requestId'),
        appOrigin,
        domain,
        chainId: requireChainId(params.get('chainId')),
        requestedAt: requireString(params.get('requestedAt'), 'requestedAt')
    };
    if (type === passkeyWalletConnectType) {
        return {
            ...base,
            type: passkeyWalletConnectType
        };
    }
    return {
        ...base,
        type: passkeyWalletSignMessageType,
        address: requireAddress(params.get('address'), 'address'),
        message: requireString(params.get('message'), 'message')
    };
};
export const parsePasskeyWalletDisconnectRequest = (params) => {
    const type = requireString(params.get('type'), 'type');
    if (type !== passkeyWalletDisconnectType) {
        throw new Error('Unsupported Organigram wallet disconnect request type.');
    }
    const version = Number(requireString(params.get('version'), 'version'));
    if (version !== 1) {
        throw new Error('Unsupported Organigram wallet disconnect request version.');
    }
    const appOrigin = requireHttpsOrigin(requireString(params.get('appOrigin'), 'appOrigin'), 'appOrigin').origin;
    const domain = normalizeHost(requireString(params.get('domain'), 'domain'));
    if (domain !== normalizeHost(new URL(appOrigin).host)) {
        throw new Error('Organigram wallet disconnect domain must match appOrigin.');
    }
    return {
        type: passkeyWalletDisconnectType,
        version: 1,
        requestId: requireString(params.get('requestId'), 'requestId'),
        appOrigin,
        domain,
        chainId: requireChainId(params.get('chainId')),
        requestedAt: requireString(params.get('requestedAt'), 'requestedAt'),
        address: requireAddress(params.get('address'), 'address')
    };
};
const requestPasskeyWalletRemoteResult = async ({ popupUrl, requestId, expectedResultType, timeoutMs }) => {
    const expectedOrigin = popupUrl.origin;
    const popup = window.open(popupUrl.toString(), 'passkey-wallet', 'popup,width=480,height=720');
    if (popup == null) {
        throw new Error('Unable to open Organigram Passkey Wallet popup.');
    }
    const openedPopup = popup;
    return await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('Organigram Passkey Wallet request timed out.'));
        }, timeoutMs);
        const cleanup = () => {
            window.clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
        };
        function handleMessage(event) {
            if (event.origin !== expectedOrigin)
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
            openedPopup.close();
            resolve(data);
        }
        window.addEventListener('message', handleMessage);
    });
};
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
export const requestPasskeyWalletSignMessage = async ({ timeoutMs = 5 * 60 * 1000, ...input }) => {
    const requestId = input.requestId ?? createRequestId();
    const popupUrl = buildPasskeyWalletRemotePopupUrl({
        ...input,
        type: passkeyWalletSignMessageType,
        requestId
    });
    return await requestPasskeyWalletRemoteResult({
        popupUrl,
        requestId,
        expectedResultType: passkeyWalletSignMessageResultType,
        timeoutMs
    });
};
