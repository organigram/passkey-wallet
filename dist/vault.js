import { createEncryptionKeyVersion, exportUserPrivateKey, exportUserPublicKey, generateUserEncryptionKeyPair } from '@organigram/js';
export const serializePasskeyWalletVaultPayload = ({ recoveryPhrase, userEncryptionPrivateKey, userEncryptionPublicKey, userEncryptionKeyVersion }) => JSON.stringify({
    version: 1,
    recoveryPhrase,
    userEncryptionPrivateKey,
    userEncryptionPublicKey,
    userEncryptionKeyVersion
});
export const parsePasskeyWalletVaultPayload = (plaintext) => {
    const payload = JSON.parse(plaintext);
    if (payload.version !== 1) {
        throw new Error('Unsupported passkey wallet vault payload version.');
    }
    if (typeof payload.recoveryPhrase !== 'string' ||
        payload.recoveryPhrase.trim() === '') {
        throw new Error('Passkey wallet vault is missing its recovery phrase.');
    }
    if (payload.userEncryptionPrivateKey == null) {
        throw new Error('Passkey wallet vault is missing its IPFS private key.');
    }
    if (payload.userEncryptionPublicKey == null) {
        throw new Error('Passkey wallet vault is missing its IPFS public key.');
    }
    if (!Number.isInteger(payload.userEncryptionKeyVersion) ||
        payload.userEncryptionKeyVersion == null) {
        throw new Error('Passkey wallet vault has an invalid IPFS key version.');
    }
    return payload;
};
export const createPasskeyWalletVaultPayload = async (recoveryPhrase) => {
    const userEncryptionKeyPair = await generateUserEncryptionKeyPair();
    const userEncryptionPrivateKey = await exportUserPrivateKey(userEncryptionKeyPair);
    const userEncryptionPublicKey = await exportUserPublicKey(userEncryptionKeyPair);
    return {
        version: 1,
        recoveryPhrase,
        userEncryptionPrivateKey,
        userEncryptionPublicKey,
        userEncryptionKeyVersion: createEncryptionKeyVersion()
    };
};
