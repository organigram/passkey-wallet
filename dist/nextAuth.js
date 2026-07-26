import { verifyPasskeyWalletSiwe } from './server';
export const authorizePasskeyWalletCredentials = async ({ chain, credentials, domain, nonce, transportOptions, transportUrl }) => {
    const message = credentials?.message;
    const signature = credentials?.signature;
    if (typeof message !== 'string' ||
        message === '' ||
        typeof signature !== 'string' ||
        !signature.startsWith('0x') ||
        nonce == null ||
        nonce === '') {
        return null;
    }
    return await verifyPasskeyWalletSiwe({
        chain,
        domain,
        message,
        nonce,
        signature: signature,
        transportOptions,
        transportUrl
    });
};
