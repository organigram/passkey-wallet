import { getAddress } from 'viem';
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts';
import { createWalletEncryptionKeyPair, parseWalletEncryptionKeyPair } from './encryption';
import { base64UrlToBytes, bytesToBase64Url, decryptPasskeyVaultSecret, derivePasskeyVaultKey, encryptPasskeyVaultSecret, randomBytes, textEncoder, toArrayBuffer } from './crypto';
import { inferPasskeyRpId as inferRpIdFromHostname } from './rpId';
const unlockedPasskeyWalletTtlMs = 15 * 60 * 1000;
const bufferSourceToBytes = (value) => value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
const createChallenge = () => randomBytes(32);
const getPasskeyPrfInput = () => toArrayBuffer(new Uint8Array(32));
const createPasskeyPrfInputsByCredential = (records) => Object.fromEntries(records.map(record => [
    record.rawCredentialId ?? record.credentialId,
    {
        first: getPasskeyPrfInput()
    }
]));
export const createBrowserPasskeyWalletVaultPayload = async (recoveryPhrase) => {
    return {
        version: 1,
        recoveryPhrase,
        walletEncryptionKey: await createWalletEncryptionKeyPair()
    };
};
export const parseBrowserPasskeyWalletVaultPayload = (plaintext) => {
    const payload = JSON.parse(plaintext);
    if (payload.version !== 1 ||
        typeof payload.recoveryPhrase !== 'string' ||
        payload.recoveryPhrase.trim() === '') {
        throw new Error('Unsupported passkey wallet vault payload.');
    }
    return {
        version: 1,
        recoveryPhrase: payload.recoveryPhrase,
        ...(payload.walletEncryptionKey == null
            ? {}
            : {
                walletEncryptionKey: parseWalletEncryptionKeyPair(payload.walletEncryptionKey)
            })
    };
};
const requirePasskeyCredential = (credential) => {
    if (credential == null || credential.type !== 'public-key') {
        throw new Error('Passkey operation did not return a public key credential.');
    }
    return credential;
};
const getPrfOutput = (credential) => {
    const first = credential.getClientExtensionResults().prf?.results?.first;
    if (first == null) {
        throw new Error('This passkey did not return a PRF output.');
    }
    return bufferSourceToBytes(first);
};
const getCredentialId = (credential) => credential.id !== ''
    ? credential.id
    : bytesToBase64Url(bufferSourceToBytes(credential.rawId));
const getRawCredentialId = (credential) => bytesToBase64Url(bufferSourceToBytes(credential.rawId));
const getCredentialTransports = (credential) => {
    const transports = credential.response instanceof AuthenticatorAttestationResponse
        ? credential.response.getTransports?.()
        : undefined;
    return Array.from(new Set(transports ?? [])).sort();
};
const getCurrentPasskeyDevice = (transports) => {
    const transportSet = new Set(transports);
    if (transportSet.has('usb') || transportSet.has('nfc') || transportSet.has('ble')) {
        return {
            kind: 'security-key',
            label: 'Security key'
        };
    }
    if (transportSet.has('hybrid') && !transportSet.has('internal')) {
        return {
            kind: 'cross-device',
            label: 'Phone passkey'
        };
    }
    const nav = navigator;
    const platformText = [
        nav.userAgentData?.platform,
        navigator.platform,
        navigator.userAgent
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (/(iphone|ipod)/.test(platformText)) {
        return {
            kind: 'ios',
            label: 'iPhone passkey'
        };
    }
    if (platformText.includes('ipad')) {
        return {
            kind: 'ipados',
            label: 'iPad passkey'
        };
    }
    if (platformText.includes('mac')) {
        return {
            kind: 'macos',
            label: 'macOS passkey'
        };
    }
    if (platformText.includes('windows')) {
        return {
            kind: 'windows',
            label: 'Windows Hello'
        };
    }
    if (platformText.includes('android')) {
        return {
            kind: 'android',
            label: 'Android passkey'
        };
    }
    if (platformText.includes('linux')) {
        return {
            kind: 'linux',
            label: 'Linux passkey'
        };
    }
    if (transportSet.has('internal')) {
        return {
            kind: 'platform',
            label: 'Device passkey'
        };
    }
    return {
        kind: 'passkey',
        label: 'Passkey'
    };
};
const createPasskeyVaultRecord = async ({ accounts, name, rpId, rpName, vaultPayload }) => {
    const primaryAccount = accounts[0];
    if (primaryAccount == null) {
        throw new Error('A passkey vault record requires at least one account.');
    }
    const credential = requirePasskeyCredential(await navigator.credentials.create({
        publicKey: {
            rp: {
                id: rpId,
                name: rpName
            },
            user: {
                id: toArrayBuffer(randomBytes(16)),
                name: primaryAccount.address,
                displayName: name.trim() || primaryAccount.address
            },
            challenge: toArrayBuffer(createChallenge()),
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            authenticatorSelection: {
                residentKey: 'required',
                requireResidentKey: true,
                userVerification: 'required'
            },
            attestation: 'none',
            timeout: 90_000,
            extensions: {
                prf: {
                    eval: {
                        first: getPasskeyPrfInput()
                    }
                }
            }
        }
    }));
    const prfOutput = getPrfOutput(credential);
    const salt = randomBytes(32);
    const key = await derivePasskeyVaultKey({
        prfOutput,
        salt
    });
    const envelope = await encryptPasskeyVaultSecret({
        plaintext: JSON.stringify(vaultPayload),
        key,
        salt
    });
    const credentialId = getCredentialId(credential);
    const rawCredentialId = getRawCredentialId(credential);
    const transports = getCredentialTransports(credential);
    return {
        version: 1,
        address: primaryAccount.address,
        accounts,
        credentialId,
        rawCredentialId,
        name: name.trim() || rpName,
        transports,
        passkeyDevice: getCurrentPasskeyDevice(transports),
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        envelope
    };
};
export const inferPasskeyRpId = (hostname = window.location.hostname) => inferRpIdFromHostname(hostname);
export const createGeneratedRecoveryPhrase = () => generateMnemonic(english, 128);
export const getDerivationPath = (addressIndex) => `m/44'/60'/0'/0/${addressIndex}`;
export const deriveStoredVaultAccount = ({ recoveryPhrase, addressIndex, name }) => {
    const account = mnemonicToAccount(recoveryPhrase, { addressIndex });
    return {
        address: getAddress(account.address),
        name: name.trim() || `Account ${addressIndex + 1}`,
        addressIndex,
        derivationPath: getDerivationPath(addressIndex)
    };
};
const createUnlockedWallet = ({ vaultAccount, credentialId, vaultPayload }) => {
    const account = mnemonicToAccount(vaultPayload.recoveryPhrase, {
        addressIndex: vaultAccount.addressIndex
    });
    return {
        address: vaultAccount.address,
        account,
        recoveryPhrase: vaultPayload.recoveryPhrase,
        walletEncryptionKey: vaultPayload.walletEncryptionKey,
        credentialId,
        expiresAt: Date.now() + unlockedPasskeyWalletTtlMs
    };
};
export const derivePasskeyWalletAccount = ({ wallet, account }) => {
    const derivedAccount = mnemonicToAccount(wallet.recoveryPhrase, {
        addressIndex: account.addressIndex
    });
    if (derivedAccount.address.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error('Derived account metadata does not match the vault seed.');
    }
    return {
        ...wallet,
        address: account.address,
        account: derivedAccount
    };
};
export const registerBrowserPasskeyVault = async ({ recoveryPhrase, name, rpId = inferPasskeyRpId(), rpName = 'Organigram Passkey Wallet' }) => {
    if (window.PublicKeyCredential == null) {
        throw new Error('Passkeys are not available in this browser.');
    }
    const normalizedRecoveryPhrase = recoveryPhrase.trim().replace(/\s+/g, ' ');
    const account = deriveStoredVaultAccount({
        recoveryPhrase: normalizedRecoveryPhrase,
        addressIndex: 0,
        name: name.trim() || 'Account 1'
    });
    const vaultPayload = await createBrowserPasskeyWalletVaultPayload(normalizedRecoveryPhrase);
    const record = await createPasskeyVaultRecord({
        accounts: [account],
        name: name.trim() || 'Organigram Passkey Wallet',
        rpId,
        rpName,
        vaultPayload
    });
    return {
        record,
        wallet: createUnlockedWallet({
            vaultAccount: account,
            credentialId: record.credentialId,
            vaultPayload
        })
    };
};
export const registerAdditionalBrowserPasskeyVault = async ({ wallet, name, accounts, rpId = inferPasskeyRpId(), rpName = 'Organigram Passkey Wallet' }) => {
    if (window.PublicKeyCredential == null) {
        throw new Error('Passkeys are not available in this browser.');
    }
    const vaultPayload = {
        version: 1,
        recoveryPhrase: wallet.recoveryPhrase,
        walletEncryptionKey: wallet.walletEncryptionKey
    };
    const record = await createPasskeyVaultRecord({
        accounts,
        name: name.trim() || 'Additional passkey',
        rpId,
        rpName,
        vaultPayload
    });
    return {
        record,
        wallet: {
            ...wallet,
            credentialId: record.credentialId,
            expiresAt: Date.now() + unlockedPasskeyWalletTtlMs
        }
    };
};
export const unlockBrowserPasskeyVault = async ({ records, rpId = inferPasskeyRpId() }) => {
    if (records.length === 0) {
        throw new Error('No encrypted vault record is available.');
    }
    const credential = requirePasskeyCredential(await navigator.credentials.get({
        publicKey: {
            rpId,
            challenge: toArrayBuffer(createChallenge()),
            allowCredentials: records.map(record => ({
                type: 'public-key',
                id: toArrayBuffer(base64UrlToBytes(record.rawCredentialId ?? record.credentialId)),
                transports: record.transports
            })),
            userVerification: 'required',
            timeout: 90_000,
            extensions: {
                prf: {
                    evalByCredential: createPasskeyPrfInputsByCredential(records)
                }
            }
        }
    }));
    const selectedCredentialIds = new Set([
        getCredentialId(credential),
        getRawCredentialId(credential)
    ]);
    const candidateRecords = records.filter(record => selectedCredentialIds.has(record.credentialId) ||
        (record.rawCredentialId != null &&
            selectedCredentialIds.has(record.rawCredentialId)));
    const recordsToTry = candidateRecords.length > 0 ? candidateRecords : records;
    const prfOutput = getPrfOutput(credential);
    for (const record of recordsToTry) {
        try {
            const key = await derivePasskeyVaultKey({
                prfOutput,
                salt: base64UrlToBytes(record.envelope.salt)
            });
            const plaintext = await decryptPasskeyVaultSecret({
                envelope: record.envelope,
                key
            });
            const vaultPayload = parseBrowserPasskeyWalletVaultPayload(plaintext);
            const wallet = createUnlockedWallet({
                vaultAccount: record.accounts[0],
                credentialId: record.credentialId,
                vaultPayload
            });
            if (wallet.account.address.toLowerCase() !==
                record.accounts[0].address.toLowerCase()) {
                throw new Error('Encrypted vault does not match the registered address.');
            }
            return {
                record,
                wallet,
                prfOutput
            };
        }
        catch {
            // Try the next matching encrypted vault.
        }
    }
    throw new Error('Unable to decrypt passkey wallet.');
};
export const updateStaticPasskeyVaultEncryptionKey = async ({ records, walletEncryptionKey, rpId = inferPasskeyRpId() }) => {
    const result = await unlockBrowserPasskeyVault({ records, rpId });
    const vaultPayload = {
        version: 1,
        recoveryPhrase: result.wallet.recoveryPhrase,
        walletEncryptionKey
    };
    const salt = randomBytes(32);
    const key = await derivePasskeyVaultKey({
        prfOutput: result.prfOutput,
        salt
    });
    const envelope = await encryptPasskeyVaultSecret({
        plaintext: JSON.stringify(vaultPayload),
        key,
        salt
    });
    const record = {
        ...result.record,
        envelope,
        lastUsedAt: new Date().toISOString()
    };
    return {
        record,
        wallet: createUnlockedWallet({
            vaultAccount: record.accounts[0],
            credentialId: record.credentialId,
            vaultPayload
        })
    };
};
export const getDiscoverablePasskeyPrfOutput = async ({ rpId = inferPasskeyRpId() } = {}) => {
    if (window.PublicKeyCredential == null) {
        throw new Error('Passkeys are not available in this browser.');
    }
    const credential = requirePasskeyCredential(await navigator.credentials.get({
        publicKey: {
            rpId,
            challenge: toArrayBuffer(createChallenge()),
            userVerification: 'required',
            timeout: 90_000,
            extensions: {
                prf: {
                    eval: {
                        first: getPasskeyPrfInput()
                    }
                }
            }
        }
    }));
    return getPrfOutput(credential);
};
export const signPersonalMessage = async ({ wallet, message }) => await wallet.account.signMessage({
    message
});
export const hexEncodeMessage = (message) => `0x${Array.from(textEncoder.encode(message))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`;
