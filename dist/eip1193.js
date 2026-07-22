import { createWalletClient, getAddress, hexToString, http, numberToHex } from 'viem';
const normalizePersonalSignMessage = (message) => {
    if (typeof message !== 'string') {
        throw new Error('Passkey wallet expected a string message.');
    }
    if (message.startsWith('0x')) {
        return hexToString(message);
    }
    return message;
};
export const createPasskeyWalletProvider = ({ wallet, chain, rpcUrl, switchChain, actions }) => {
    const listeners = new Map();
    let currentChain = chain;
    const emit = (event, ...args) => {
        listeners.get(event)?.forEach(listener => {
            listener(...args);
        });
    };
    const getWalletClient = () => createWalletClient({
        account: wallet.account,
        chain: currentChain,
        transport: http(rpcUrl)
    });
    const request = (async ({ method, params }) => {
        const requestParams = Array.isArray(params) ? params : [];
        const exportSeedPhrase = actions.exportPasskeyWalletSeedPhrase ??
            actions.exportPasskeyWalletRecoveryPhrase;
        switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
                return [wallet.address];
            case 'eth_chainId':
                return numberToHex(currentChain.id);
            case 'wallet_switchEthereumChain': {
                const chainId = Number.parseInt(String(requestParams[0]?.chainId), 16);
                currentChain = switchChain(chainId);
                emit('chainChanged', numberToHex(currentChain.id));
                return null;
            }
            case 'personal_sign':
                return await wallet.account.signMessage({
                    message: normalizePersonalSignMessage(requestParams[0])
                });
            case 'eth_sign':
                return await wallet.account.signMessage({
                    message: normalizePersonalSignMessage(requestParams[1])
                });
            case 'eth_signTypedData':
            case 'eth_signTypedData_v3':
            case 'eth_signTypedData_v4': {
                const typedData = typeof requestParams[1] === 'string'
                    ? JSON.parse(requestParams[1])
                    : requestParams[1];
                return await wallet.account.signTypedData(typedData);
            }
            case 'eth_sendTransaction':
                return await getWalletClient().sendTransaction(requestParams[0]);
            case 'organigram_addPasskey': {
                return await actions.registerAdditionalPasskeyCredential({
                    wallet,
                    name: typeof requestParams[0] === 'object' &&
                        requestParams[0] != null &&
                        'name' in requestParams[0]
                        ? String(requestParams[0].name ?? '')
                        : undefined
                });
            }
            case 'organigram_exportSeedPhrase':
            case 'organigram_exportRecoveryPhrase':
                if (exportSeedPhrase == null) {
                    throw new Error('Seed phrase export is not available.');
                }
                return await exportSeedPhrase({
                    expectedAddress: wallet.address
                });
            default: {
                const response = await fetch(rpcUrl, {
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
export const normalizePasskeyWalletAddress = (address) => getAddress(address);
