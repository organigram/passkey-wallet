import { createWalletEncryptionKeyPair, parseWalletEncryptionKeyPair } from './encryption';
export const serializePasskeyWalletVaultPayload = ({ recoveryPhrase, walletEncryptionKey }) => JSON.stringify({
    version: 1,
    recoveryPhrase,
    ...(walletEncryptionKey == null ? {} : { walletEncryptionKey })
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
export const createPasskeyWalletVaultPayload = async (recoveryPhrase) => ({
    version: 1,
    recoveryPhrase,
    walletEncryptionKey: await createWalletEncryptionKeyPair()
});
