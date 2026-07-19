export const organigramPasskeyWalletId = 'organigram-passkeys';
export const organigramPasskeyWalletIcon = '/png/logo-gradient.png';
const normalizePasskeyIdentityEmail = (email) => email.trim().toLowerCase();
export const buildIdentityPasskeyCapabilities = (email) => {
    const normalizedEmail = normalizePasskeyIdentityEmail(email);
    return {
        method: 'register',
        name: normalizedEmail,
        identity: {
            email: normalizedEmail
        }
    };
};
export const buildPasskeyWalletCapabilities = () => ({
    method: 'login'
});
export const buildEmailPasskeyCapabilities = buildIdentityPasskeyCapabilities;
