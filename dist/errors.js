export const passkeyPrfUnavailableErrorMessage = "This password manager is not compatible with Organigram's passkey wallet. Please use a different password manager to unlock your wallet.";
export class PasskeyPrfUnavailableError extends Error {
    constructor(message = passkeyPrfUnavailableErrorMessage) {
        super(message);
        this.name = 'PasskeyPrfUnavailableError';
    }
}
export class PasskeyVaultDecryptError extends Error {
    constructor(message = 'Unable to decrypt passkey wallet.') {
        super(message);
        this.name = 'PasskeyVaultDecryptError';
    }
}
