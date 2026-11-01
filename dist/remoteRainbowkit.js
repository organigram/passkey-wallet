import { getAddress, hexToString, isAddress, isHex, numberToHex } from 'viem';
import { createConnector } from 'wagmi';
import { buildPasskeyWalletRemotePopupUrl, assertPasskeyWalletSignMessageResult, assertPasskeyWalletSignTypedDataResult, parsePasskeyWalletTypedData, passkeyWalletRemoteRequestPayloadType, passkeyWalletConnectResultType, passkeyWalletConnectType, passkeyWalletSignMessageResultType, passkeyWalletSignMessageType, passkeyWalletSignTypedDataResultType, passkeyWalletSignTypedDataType, passkeyWalletSendTransactionResultType, passkeyWalletSendTransactionType, passkeyWalletRemoteErrorResultType } from './remoteProtocol';
import { organigramPasskeyWalletIcon, organigramPasskeyWalletId } from './types';
import { getAcceptedWalletOrigins, postToWalletPopup, rememberWalletOrigin, toPreferredWalletUrl, watchLocalWalletPopup } from './walletOrigin';
const remoteWalletName = 'Passkey Wallet';
const remoteWalletId = organigramPasskeyWalletId;
const remoteWalletConnectionStorageKey = 'organigram.remotePasskeyWallet.connection.v1';
export const organigramRemotePasskeyWalletId = remoteWalletId;
const getLocalStorage = () => {
    if (typeof window === 'undefined')
        return null;
    try {
        return window.localStorage;
    }
    catch {
        return null;
    }
};
const parseStoredConnection = (value) => {
    if (value == null || value === '')
        return null;
    try {
        const parsed = JSON.parse(value);
        if (parsed.version !== 1 ||
            typeof parsed.address !== 'string' ||
            typeof parsed.chainId !== 'number' ||
            !Number.isSafeInteger(parsed.chainId) ||
            parsed.chainId <= 0 ||
            typeof parsed.connectedAt !== 'string') {
            return null;
        }
        return {
            version: 1,
            address: getAddress(parsed.address),
            chainId: parsed.chainId,
            connectedAt: parsed.connectedAt
        };
    }
    catch {
        return null;
    }
};
export const getOrganigramRemotePasskeyWalletConnection = () => parseStoredConnection(getLocalStorage()?.getItem(remoteWalletConnectionStorageKey) ?? null);
export const rememberOrganigramRemotePasskeyWalletConnection = ({ address, chainId }) => {
    const storage = getLocalStorage();
    if (storage == null)
        return;
    const connection = {
        version: 1,
        address: getAddress(address),
        chainId,
        connectedAt: new Date().toISOString()
    };
    try {
        storage.setItem(remoteWalletConnectionStorageKey, JSON.stringify(connection));
    }
    catch {
        // Local storage can be unavailable in hardened browser modes.
    }
};
export const clearOrganigramRemotePasskeyWalletConnection = () => {
    try {
        getLocalStorage()?.removeItem(remoteWalletConnectionStorageKey);
    }
    catch {
        // Local storage can be unavailable in hardened browser modes.
    }
};
export const hydrateOrganigramRemoteWalletConnection = async ({ address, chainId, connectAsync, connectors, defaultChainId = 11155111 }) => {
    const resolvedChainId = chainId ?? defaultChainId;
    rememberOrganigramRemotePasskeyWalletConnection({
        address,
        chainId: resolvedChainId
    });
    const connector = connectors.find(candidate => candidate.id === organigramRemotePasskeyWalletId);
    if (connector == null)
        return;
    try {
        await connectAsync({ connector });
    }
    catch (error) {
        clearOrganigramRemotePasskeyWalletConnection();
        console.warn('Unable to hydrate Organigram Passkey Wallet connection:', error);
    }
};
const createRequestId = () => {
    if (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};
let pendingApprovalSequence = null;
/**
 * Adds presentation-only context to the next wallet approvals. This lets an
 * app tell the wallet that one user action requires several signatures,
 * without broadening any approval or altering its signed payload.
 */
export const beginOrganigramWalletApprovalSequence = ({ count, label }) => {
    if (!Number.isSafeInteger(count) || count < 1) {
        throw new Error('Organigram Wallet approval count must be a positive integer.');
    }
    const sequence = {
        count,
        nextStep: 1,
        ...(label == null || label === '' ? {} : { label })
    };
    pendingApprovalSequence = sequence;
    return () => {
        if (pendingApprovalSequence === sequence) {
            pendingApprovalSequence = null;
        }
    };
};
const consumeOrganigramWalletApprovalSequence = () => {
    const sequence = pendingApprovalSequence;
    if (sequence == null)
        return undefined;
    const approval = {
        approvalStep: sequence.nextStep,
        approvalCount: sequence.count,
        ...(sequence.label == null ? {} : { approvalLabel: sequence.label })
    };
    sequence.nextStep += 1;
    if (sequence.nextStep > sequence.count) {
        pendingApprovalSequence = null;
    }
    return approval;
};
const normalizePersonalSignMessage = (message) => {
    if (typeof message !== 'string') {
        throw new Error('Organigram Wallet expected a string message.');
    }
    if (message.startsWith('0x')) {
        return hexToString(message);
    }
    return message;
};
const normalizeSignTypedDataRequest = (params, connectedAddress) => {
    const [first, second] = params;
    const firstIsAddress = typeof first === 'string' && /^0x[a-fA-F0-9]{40}$/.test(first);
    const secondIsAddress = typeof second === 'string' && /^0x[a-fA-F0-9]{40}$/.test(second);
    const address = (firstIsAddress ? first : secondIsAddress ? second : connectedAddress);
    const typedDataInput = firstIsAddress
        ? second
        : secondIsAddress
            ? first
            : second;
    if (getAddress(address) !== getAddress(connectedAddress)) {
        throw new Error(`Organigram Wallet cannot sign typed data for ${getAddress(address)} while connected as ${getAddress(connectedAddress)}.`);
    }
    return {
        address: getAddress(address),
        typedData: parsePasskeyWalletTypedData(typedDataInput)
    };
};
const normalizeTransactionRequest = (value, connectedAddress) => {
    if (typeof value !== 'object' || value == null) {
        throw new Error('Organigram Wallet expected a transaction object.');
    }
    const transaction = value;
    const from = transaction.from == null ? connectedAddress : String(transaction.from);
    const to = String(transaction.to ?? '');
    if (!isAddress(from) ||
        getAddress(from) !== getAddress(connectedAddress) ||
        !isAddress(to)) {
        throw new Error('Organigram Wallet transaction account or destination is invalid.');
    }
    const result = {
        from: getAddress(from),
        to: getAddress(to)
    };
    for (const key of [
        'data',
        'value',
        'gas',
        'gasPrice',
        'maxFeePerGas',
        'maxPriorityFeePerGas',
        'nonce'
    ]) {
        const field = transaction[key];
        if (field == null)
            continue;
        if (typeof field !== 'string' || !isHex(field)) {
            throw new Error(`Organigram Wallet transaction ${key} must be hexadecimal.`);
        }
        result[key] = field;
    }
    return result;
};
const createRemotePopupTransport = (walletOrigin) => {
    let popup = null;
    let closeTimer = null;
    const clearCloseTimer = () => {
        if (closeTimer == null)
            return;
        window.clearTimeout(closeTimer);
        closeTimer = null;
    };
    const closePopup = () => {
        clearCloseTimer();
        if (popup != null && !popup.closed) {
            popup.close();
        }
        popup = null;
    };
    const schedulePopupClose = () => {
        clearCloseTimer();
        closeTimer = window.setTimeout(() => {
            closePopup();
        }, 30000);
    };
    const request = async ({ type, expectedResultType, chainId, address, message, typedData, transaction, timeoutMs = 5 * 60 * 1000 }) => {
        const requestId = createRequestId();
        const approval = consumeOrganigramWalletApprovalSequence();
        const configuredPopupUrl = buildPasskeyWalletRemotePopupUrl({
            walletOrigin,
            type,
            requestId,
            chainId,
            ...approval,
            ...(address == null ? {} : { address })
        });
        const configuredOrigin = configuredPopupUrl.origin;
        const acceptedOrigins = getAcceptedWalletOrigins(configuredOrigin);
        const popupUrl = toPreferredWalletUrl(configuredPopupUrl);
        const requestPayload = address != null &&
            (message != null || typedData != null || transaction != null)
            ? {
                type: passkeyWalletRemoteRequestPayloadType,
                version: 1,
                request: {
                    type,
                    version: 1,
                    requestId,
                    appOrigin: popupUrl.searchParams.get('appOrigin') ?? '',
                    domain: popupUrl.searchParams.get('domain') ?? '',
                    chainId,
                    requestedAt: popupUrl.searchParams.get('requestedAt') ?? '',
                    address,
                    ...approval,
                    ...(message == null ? {} : { message }),
                    ...(typedData == null ? {} : { typedData }),
                    ...(transaction == null ? {} : { transaction })
                }
            }
            : null;
        clearCloseTimer();
        if (popup == null || popup.closed) {
            popup = window.open(popupUrl.toString(), 'passkey-wallet', 'popup,width=480,height=720');
        }
        else {
            popup.location.href = popupUrl.toString();
            popup.focus();
        }
        if (popup == null) {
            throw new Error('Unable to open Organigram Wallet popup.');
        }
        const openedPopup = popup;
        return await new Promise((resolve, reject) => {
            const stopWatchingLocalWallet = watchLocalWalletPopup({
                popup: openedPopup,
                popupUrl,
                walletOrigin: configuredOrigin,
                requestId
            });
            const timeout = window.setTimeout(() => {
                cleanup();
                closePopup();
                reject(new Error('Organigram Wallet request timed out.'));
            }, timeoutMs);
            const payloadTimer = requestPayload == null
                ? null
                : window.setInterval(() => {
                    postToWalletPopup(openedPopup, requestPayload, configuredOrigin);
                }, 250);
            const cleanup = () => {
                window.clearTimeout(timeout);
                if (payloadTimer != null)
                    window.clearInterval(payloadTimer);
                stopWatchingLocalWallet();
                window.removeEventListener('message', handleMessage);
            };
            if (requestPayload != null) {
                postToWalletPopup(openedPopup, requestPayload, configuredOrigin);
            }
            function handleMessage(event) {
                if (!acceptedOrigins.includes(event.origin))
                    return;
                const data = event.data;
                if (data != null &&
                    data.type === passkeyWalletRemoteErrorResultType &&
                    data.version === 1 &&
                    data.requestId === requestId &&
                    data.chainId === chainId &&
                    typeof data.error === 'string') {
                    cleanup();
                    closePopup();
                    reject(new Error(data.error));
                    return;
                }
                if (data == null ||
                    data.type !== expectedResultType ||
                    data.version !== 1 ||
                    data.requestId !== requestId ||
                    typeof data.address !== 'string' ||
                    typeof data.chainId !== 'number') {
                    return;
                }
                cleanup();
                // A following approval can reuse this user-initiated popup. The last
                // (or standalone) approval closes it immediately.
                if (approval != null &&
                    approval.approvalStep < approval.approvalCount) {
                    schedulePopupClose();
                }
                else {
                    closePopup();
                }
                rememberWalletOrigin(configuredOrigin, event.origin);
                resolve(data);
            }
            window.addEventListener('message', handleMessage);
        });
    };
    return {
        connect: async ({ chainId }) => await request({
            type: passkeyWalletConnectType,
            expectedResultType: passkeyWalletConnectResultType,
            chainId
        }),
        signMessage: async ({ address, chainId, message }) => {
            const result = await request({
                type: passkeyWalletSignMessageType,
                expectedResultType: passkeyWalletSignMessageResultType,
                chainId,
                address,
                message
            });
            await assertPasskeyWalletSignMessageResult({
                result,
                address,
                chainId,
                message
            });
            return result;
        },
        signTypedData: async ({ address, chainId, typedData }) => {
            const result = await request({
                type: passkeyWalletSignTypedDataType,
                expectedResultType: passkeyWalletSignTypedDataResultType,
                chainId,
                address,
                typedData
            });
            await assertPasskeyWalletSignTypedDataResult({
                result,
                address,
                chainId,
                typedData
            });
            return result;
        },
        sendTransaction: async ({ address, chainId, transaction }) => await request({
            type: passkeyWalletSendTransactionType,
            expectedResultType: passkeyWalletSendTransactionResultType,
            chainId,
            address,
            transaction
        })
    };
};
const createRemotePasskeyWalletProvider = ({ getAddress, getChain, rpcUrl, switchChain, requestPersonalSign, requestSignTypedData, requestSendTransaction }) => {
    const listeners = new Map();
    const emit = (event, ...args) => {
        listeners.get(event)?.forEach(listener => {
            listener(...args);
        });
    };
    const requireConnectedAddress = () => {
        const address = getAddress();
        if (address == null) {
            throw new Error('Organigram Wallet is not connected.');
        }
        return address;
    };
    const request = (async ({ method, params }) => {
        const requestParams = Array.isArray(params) ? params : [];
        switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
                return [requireConnectedAddress()];
            case 'eth_chainId':
                return numberToHex(getChain().id);
            case 'wallet_switchEthereumChain': {
                const chainId = Number.parseInt(String(requestParams[0]?.chainId), 16);
                const nextChain = switchChain(chainId);
                emit('chainChanged', numberToHex(nextChain.id));
                return null;
            }
            case 'personal_sign': {
                const address = requireConnectedAddress();
                const message = normalizePersonalSignMessage(requestParams[0]);
                const result = await requestPersonalSign({
                    address,
                    chainId: getChain().id,
                    message
                });
                await assertPasskeyWalletSignMessageResult({
                    result,
                    address,
                    chainId: getChain().id,
                    message
                });
                return result.signature;
            }
            case 'eth_sign': {
                const address = requireConnectedAddress();
                const message = normalizePersonalSignMessage(requestParams[1]);
                const result = await requestPersonalSign({
                    address,
                    chainId: getChain().id,
                    message
                });
                await assertPasskeyWalletSignMessageResult({
                    result,
                    address,
                    chainId: getChain().id,
                    message
                });
                return result.signature;
            }
            case 'eth_signTypedData':
            case 'eth_signTypedData_v3':
            case 'eth_signTypedData_v4': {
                const connectedAddress = requireConnectedAddress();
                const { address, typedData } = normalizeSignTypedDataRequest(requestParams, connectedAddress);
                const result = await requestSignTypedData({
                    address,
                    chainId: getChain().id,
                    typedData
                });
                await assertPasskeyWalletSignTypedDataResult({
                    result,
                    address,
                    chainId: getChain().id,
                    typedData
                });
                return result.signature;
            }
            case 'eth_sendTransaction': {
                const address = requireConnectedAddress();
                const transaction = normalizeTransactionRequest(requestParams[0], address);
                const result = await requestSendTransaction({
                    address,
                    chainId: getChain().id,
                    transaction
                });
                if (result.address.toLowerCase() !== address.toLowerCase() ||
                    result.chainId !== getChain().id ||
                    !isHex(result.transactionHash)) {
                    throw new Error('Organigram Wallet returned an invalid transaction result.');
                }
                return result.transactionHash;
            }
            default: {
                const response = await fetch(rpcUrl(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method,
                        params: requestParams
                    })
                });
                const body = (await response.json());
                if (body.error != null) {
                    throw new Error(body.error.message ?? 'RPC request failed.');
                }
                return body.result;
            }
        }
    });
    return {
        request,
        on: (event, listener) => {
            const eventListeners = listeners.get(event) ?? new Set();
            eventListeners.add(listener);
            listeners.set(event, eventListeners);
        },
        removeListener: (event, listener) => {
            listeners.get(event)?.delete(listener);
        }
    };
};
export const createOrganigramRemotePasskeyWallet = ({ walletOrigin, requestConnect, requestPersonalSign, requestSignTypedData, requestSendTransaction } = {}) => {
    const remotePopupTransport = createRemotePopupTransport(walletOrigin);
    const connectRemote = requestConnect ?? remotePopupTransport.connect;
    const signRemoteMessage = requestPersonalSign ?? remotePopupTransport.signMessage;
    const signRemoteTypedData = requestSignTypedData ?? remotePopupTransport.signTypedData;
    const sendRemoteTransaction = requestSendTransaction ?? remotePopupTransport.sendTransaction;
    return {
        id: remoteWalletId,
        name: remoteWalletName,
        shortName: 'Organigram',
        rdns: 'ai.organigram.wallet',
        iconUrl: organigramPasskeyWalletIcon,
        iconAccent: '#00C2A8',
        iconBackground: '#18272B',
        installed: true,
        createConnector: (walletDetails) => createConnector(config => {
            let provider = null;
            let address = null;
            let activeChain = config.chains[0];
            const resolveChain = (chainId) => {
                const chain = chainId == null
                    ? activeChain
                    : config.chains.find(candidate => candidate.id === chainId);
                if (chain == null) {
                    throw new Error('Unsupported network for Organigram Wallet.');
                }
                return chain;
            };
            const getRpcUrl = (chain) => chain.rpcUrls.default.http[0] ?? chain.rpcUrls.public?.http[0] ?? '';
            const ensureProvider = () => {
                provider ??= createRemotePasskeyWalletProvider({
                    getAddress: () => address,
                    getChain: () => activeChain,
                    rpcUrl: () => getRpcUrl(activeChain),
                    switchChain: chainId => {
                        activeChain = resolveChain(chainId);
                        config.emitter.emit('change', {
                            chainId: activeChain.id
                        });
                        return activeChain;
                    },
                    requestPersonalSign: signRemoteMessage,
                    requestSignTypedData: signRemoteTypedData,
                    requestSendTransaction: sendRemoteTransaction
                });
                return provider;
            };
            const restoreStoredConnection = () => {
                const connection = getOrganigramRemotePasskeyWalletConnection();
                if (connection == null)
                    return false;
                try {
                    address = getAddress(connection.address);
                    activeChain = resolveChain(connection.chainId);
                    ensureProvider();
                    return true;
                }
                catch {
                    address = null;
                    provider = null;
                    clearOrganigramRemotePasskeyWalletConnection();
                    return false;
                }
            };
            const formatConnectionResult = (withCapabilities) => {
                if (address == null) {
                    throw new Error('Organigram Wallet is not connected.');
                }
                if (withCapabilities === true) {
                    return {
                        accounts: [
                            {
                                address,
                                capabilities: {}
                            }
                        ],
                        chainId: activeChain.id
                    };
                }
                return {
                    accounts: [address],
                    chainId: activeChain.id
                };
            };
            return {
                ...walletDetails,
                id: remoteWalletId,
                name: remoteWalletName,
                type: 'organigram-remote-wallet',
                async connect(parameters) {
                    if (restoreStoredConnection()) {
                        config.emitter.emit('connect', {
                            accounts: address == null ? [] : [address],
                            chainId: activeChain.id
                        });
                        return formatConnectionResult(parameters?.withCapabilities);
                    }
                    activeChain = resolveChain(parameters?.chainId);
                    const connection = await connectRemote({
                        chainId: activeChain.id
                    });
                    address = getAddress(connection.address);
                    activeChain = resolveChain(connection.chainId);
                    rememberOrganigramRemotePasskeyWalletConnection({
                        address,
                        chainId: activeChain.id
                    });
                    ensureProvider();
                    config.emitter.emit('connect', {
                        accounts: [address],
                        chainId: activeChain.id
                    });
                    return formatConnectionResult(parameters?.withCapabilities);
                },
                async disconnect() {
                    address = null;
                    provider = null;
                    clearOrganigramRemotePasskeyWalletConnection();
                    config.emitter.emit('disconnect');
                },
                async getAccounts() {
                    if (address == null) {
                        restoreStoredConnection();
                    }
                    return address == null ? [] : [address];
                },
                async getChainId() {
                    if (address == null) {
                        restoreStoredConnection();
                    }
                    return activeChain.id;
                },
                async getProvider() {
                    if (address == null) {
                        restoreStoredConnection();
                    }
                    return ensureProvider();
                },
                async isAuthorized() {
                    return address != null || restoreStoredConnection();
                },
                async switchChain({ chainId }) {
                    activeChain = resolveChain(chainId);
                    if (address != null) {
                        rememberOrganigramRemotePasskeyWalletConnection({
                            address,
                            chainId: activeChain.id
                        });
                    }
                    config.emitter.emit('change', {
                        chainId
                    });
                    return activeChain;
                },
                onAccountsChanged(accounts) {
                    address =
                        accounts[0] == null
                            ? null
                            : getAddress(accounts[0]);
                    if (address == null) {
                        clearOrganigramRemotePasskeyWalletConnection();
                    }
                    else {
                        rememberOrganigramRemotePasskeyWalletConnection({
                            address,
                            chainId: activeChain.id
                        });
                    }
                    config.emitter.emit('change', {
                        accounts: address == null ? [] : [address]
                    });
                },
                onChainChanged(chainId) {
                    activeChain = resolveChain(Number.parseInt(chainId, 16));
                    if (address != null) {
                        rememberOrganigramRemotePasskeyWalletConnection({
                            address,
                            chainId: activeChain.id
                        });
                    }
                    config.emitter.emit('change', {
                        chainId: activeChain.id
                    });
                },
                onDisconnect() {
                    address = null;
                    provider = null;
                    clearOrganigramRemotePasskeyWalletConnection();
                    config.emitter.emit('disconnect');
                }
            };
        })
    };
};
