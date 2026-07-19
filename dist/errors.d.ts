export declare const passkeyPrfUnavailableErrorMessage = "This password manager is not compatible with Organigram's passkey wallet. Please use a different password manager to unlock your wallet.";
export declare class PasskeyPrfUnavailableError extends Error {
    constructor(message?: string);
}
export declare class PasskeyVaultDecryptError extends Error {
    constructor(message?: string);
}
