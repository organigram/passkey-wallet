import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { base64UrlToBytes, decryptPasskeyVaultSecret, derivePasskeyVaultKey, encryptPasskeyVaultSecret } from './crypto';
import { PasskeyPrfUnavailableError } from './errors';
import { createNewPasskeyWalletVault, createUnlockedPasskeyWallet } from './wallet';
import { parsePasskeyWalletVaultPayload, serializePasskeyWalletVaultPayload } from './vault';
export { parsePasskeyWalletVaultPayload, serializePasskeyWalletVaultPayload };
const readJson = async (response) => {
    const body = (await response.json().catch(() => null));
    if (!response.ok) {
        throw new Error(body?.error ?? `Request failed with status ${response.status}`);
    }
    return body;
};
const postJson = async (path, body) => {
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    return await readJson(response);
};
export const createFetchPasskeyWalletApiClient = (basePath = '/api/auth/passkey') => ({
    registerOptions: async (input) => await postJson(`${basePath}/register/options`, input),
    registerVerify: async (input) => await postJson(`${basePath}/register/verify`, input),
    unlockOptions: async () => await postJson(`${basePath}/unlock/options`, {}),
    unlockVerify: async (input) => await postJson(`${basePath}/unlock/verify`, input)
});
const hydrateSerializedPrfValue = (value) => {
    if (value == null)
        return value;
    if (typeof value === 'string')
        return base64UrlToBytes(value);
    if (value instanceof ArrayBuffer)
        return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value))
        return new Uint8Array(value);
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.every(([key, entryValue]) => /^\d+$/.test(key) && typeof entryValue === 'number')) {
            return new Uint8Array(entries
                .sort(([left], [right]) => Number(left) - Number(right))
                .map(([, entryValue]) => entryValue));
        }
    }
    return value;
};
const hydratePrfValueSet = (valueSet) => {
    if (valueSet == null)
        return valueSet;
    return {
        ...valueSet,
        first: hydrateSerializedPrfValue(valueSet.first),
        ...(valueSet.second != null
            ? {
                second: hydrateSerializedPrfValue(valueSet.second)
            }
            : {})
    };
};
export const hydratePasskeyPrfOptions = (options) => {
    const extensions = options.extensions;
    const prf = extensions?.prf;
    if (prf == null)
        return options;
    return {
        ...options,
        extensions: {
            ...extensions,
            prf: {
                ...prf,
                ...(prf.eval != null ? { eval: hydratePrfValueSet(prf.eval) } : {}),
                ...(prf.evalByCredential != null
                    ? {
                        evalByCredential: Object.fromEntries(Object.entries(prf.evalByCredential).map(([credentialId, valueSet]) => [
                            credentialId,
                            hydratePrfValueSet(valueSet)
                        ]))
                    }
                    : {})
            }
        }
    };
};
const getPasskeyPrfOutput = (response) => {
    const first = response.clientExtensionResults?.prf?.results?.first;
    if (first == null || first === '') {
        throw new PasskeyPrfUnavailableError();
    }
    return typeof first === 'string'
        ? base64UrlToBytes(first)
        : new Uint8Array(first);
};
export async function registerPasskeyCredentialEnvelope({ api, address, vaultPayload, email, name }) {
    const { options } = await api.registerOptions({
        address,
        email,
        name
    });
    const registrationResponse = await startRegistration({
        optionsJSON: hydratePasskeyPrfOptions(options)
    });
    const prfOutput = getPasskeyPrfOutput(registrationResponse);
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const key = await derivePasskeyVaultKey({
        prfOutput,
        salt
    });
    const envelope = await encryptPasskeyVaultSecret({
        plaintext: serializePasskeyWalletVaultPayload(vaultPayload),
        key,
        salt
    });
    return await api.registerVerify({
        response: registrationResponse,
        envelope: {
            address,
            encryptedMnemonic: envelope.ciphertext,
            salt: envelope.salt,
            nonce: envelope.nonce,
            algorithm: envelope.algorithm,
            keyVersion: envelope.keyVersion
        }
    });
}
export const registerPasskeyWallet = async ({ api, capabilities }) => {
    const { address, vaultPayload } = await createNewPasskeyWalletVault({
        capabilities
    });
    const credential = await registerPasskeyCredentialEnvelope({
        api,
        address,
        vaultPayload,
        email: capabilities.identity?.email ?? null,
        name: capabilities.name ?? capabilities.identity?.email ?? null
    });
    return createUnlockedPasskeyWallet({
        address: credential.address,
        credentialId: credential.credentialId,
        vaultPayload
    });
};
export const unlockPasskeyWallet = async ({ api }) => {
    const { options, hasCredentials } = await api.unlockOptions();
    if (!hasCredentials)
        return null;
    const authenticationResponse = await startAuthentication({
        optionsJSON: hydratePasskeyPrfOptions(options)
    });
    const prfOutput = getPasskeyPrfOutput(authenticationResponse);
    const result = await api.unlockVerify({
        response: authenticationResponse
    });
    const key = await derivePasskeyVaultKey({
        prfOutput,
        salt: base64UrlToBytes(result.envelope.salt)
    });
    const vaultPlaintext = await decryptPasskeyVaultSecret({
        envelope: result.envelope,
        key
    });
    const vaultPayload = parsePasskeyWalletVaultPayload(vaultPlaintext);
    const wallet = createUnlockedPasskeyWallet({
        address: result.address,
        credentialId: result.credentialId,
        vaultPayload
    });
    if (wallet.account.address.toLowerCase() !== result.address.toLowerCase()) {
        throw new Error('Passkey wallet envelope does not match its address.');
    }
    return wallet;
};
export const exportPasskeyWalletRecoveryPhrase = async ({ api, expectedAddress }) => {
    const wallet = await unlockPasskeyWallet({ api });
    if (wallet == null) {
        throw new Error('No passkey wallet is available to export.');
    }
    if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error('Selected passkey does not unlock this wallet.');
    }
    return wallet.recoveryPhrase;
};
export const registerAdditionalPasskeyCredential = async ({ api, wallet, name }) => await registerPasskeyCredentialEnvelope({
    api,
    address: wallet.address,
    vaultPayload: {
        version: 1,
        recoveryPhrase: wallet.recoveryPhrase,
        userEncryptionPrivateKey: wallet.userEncryptionPrivateKey,
        userEncryptionPublicKey: wallet.userEncryptionPublicKey,
        userEncryptionKeyVersion: wallet.userEncryptionKeyVersion
    },
    name: name ?? 'Backup passkey'
});
export const isPasskeyCredentialUnavailableError = (error) => {
    if (typeof error !== 'object' || error == null)
        return false;
    const { name, message } = error;
    const normalizedName = typeof name === 'string' ? name.toLowerCase() : '';
    const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
    return (normalizedName === 'notallowederror' ||
        normalizedName === 'invalidstateerror' ||
        normalizedMessage.includes('no credentials') ||
        normalizedMessage.includes('not allowed') ||
        normalizedMessage.includes('could not be completed'));
};
export const unlockOrCreatePasskeyWallet = async ({ api, capabilities }) => {
    if (typeof window === 'undefined' || window.PublicKeyCredential == null) {
        throw new Error('Passkeys are not available in this browser.');
    }
    if (capabilities.method !== 'register') {
        try {
            const wallet = await unlockPasskeyWallet({ api });
            if (wallet != null)
                return wallet;
        }
        catch (error) {
            if (!isPasskeyCredentialUnavailableError(error)) {
                throw error;
            }
        }
    }
    return await registerPasskeyWallet({
        api,
        capabilities: {
            ...capabilities,
            method: 'register'
        }
    });
};
