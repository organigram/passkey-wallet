import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts';
import { createPasskeyWalletVaultPayload } from './vault';
export const unlockedPasskeyWalletTtlMs = 15 * 60 * 1000;
export const createUnlockedPasskeyWallet = ({ address, credentialId, vaultPayload, now = Date.now() }) => {
    const account = mnemonicToAccount(vaultPayload.recoveryPhrase);
    return {
        address,
        account,
        recoveryPhrase: vaultPayload.recoveryPhrase,
        walletEncryptionKey: vaultPayload.walletEncryptionKey,
        credentialId,
        expiresAt: now + unlockedPasskeyWalletTtlMs
    };
};
export const createNewPasskeyWalletVault = async () => {
    const recoveryPhrase = generateMnemonic(english, 128);
    const vaultPayload = await createPasskeyWalletVaultPayload(recoveryPhrase);
    const account = mnemonicToAccount(recoveryPhrase);
    return {
        address: account.address,
        vaultPayload
    };
};
