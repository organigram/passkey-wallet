import { normalizeHost, requireString } from './protocol';
/** Type of a sign-in request to the wallet. */
export const passkeyWalletSignInType = 'organigram:wallet:sign-in';
/** Type of the message answering a sign-in request. */
export const passkeyWalletSignInResultType = 'organigram:wallet:sign-in-result';
/** Type of the message answering a request the wallet could not serve. */
export const passkeyWalletErrorType = 'organigram:wallet:error';
const getHostnameFromHost = (host) => host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
const isHostCompatibleWithDomain = ({ host, domain }) => {
    const normalizedHost = normalizeHost(host);
    const normalizedDomain = normalizeHost(domain);
    if (normalizedHost === normalizedDomain)
        return true;
    if (normalizedDomain.includes(':'))
        return false;
    const normalizedHostname = getHostnameFromHost(normalizedHost);
    return (normalizedHostname === normalizedDomain ||
        normalizedHostname.endsWith(`.${normalizedDomain}`));
};
const requireHttpsUrl = (value, field) => {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
        throw new Error(`Organigram wallet ${field} must use HTTPS.`);
    }
    return url;
};
const readParam = (params, field) => requireString(params.get(field), field);
/**
 * Read and check a sign-in request from the URL parameters of the wallet popup.
 *
 * @remarks
 * The challenge URL must use HTTPS and belong to the requested domain or one of
 * its subdomains, and the return URL must use HTTPS, so that the wallet only
 * signs messages fetched from the app asking for them.
 * @param params - The URL parameters.
 * @throws When the request is invalid or of an unsupported type or version.
 */
export const parsePasskeyWalletSignInRequest = (params) => {
    const type = readParam(params, 'type');
    if (type !== passkeyWalletSignInType) {
        throw new Error('Unsupported Organigram wallet request type.');
    }
    const version = Number(readParam(params, 'version'));
    if (version !== 1) {
        throw new Error('Unsupported Organigram wallet request version.');
    }
    const domain = normalizeHost(readParam(params, 'domain'));
    const challengeUrl = readParam(params, 'challengeUrl');
    const parsedChallengeUrl = requireHttpsUrl(challengeUrl, 'challengeUrl');
    if (!isHostCompatibleWithDomain({
        host: parsedChallengeUrl.host,
        domain
    })) {
        throw new Error('Organigram wallet challenge URL must belong to the requested domain.');
    }
    const returnUrl = params.get('returnUrl')?.trim() || undefined;
    if (returnUrl != null) {
        requireHttpsUrl(returnUrl, 'returnUrl');
    }
    return {
        type: passkeyWalletSignInType,
        version: 1,
        requestId: readParam(params, 'requestId'),
        domain,
        challengeUrl,
        ...(returnUrl == null ? {} : { returnUrl }),
        requestedAt: readParam(params, 'requestedAt')
    };
};
/**
 * Check the manifest of an app.
 *
 * @remarks
 * The domain of the manifest must be the host serving it, and its URLs must use
 * HTTPS and belong to that domain or its subdomains.
 * @param manifest - The manifest, parsed from JSON.
 * @param servingHost - The host the manifest was fetched from.
 * @throws When the manifest is invalid.
 */
export const validatePasskeyWalletManifest = (manifest, servingHost) => {
    if (manifest == null || typeof manifest !== 'object') {
        throw new Error('Organigram wallet manifest must be an object.');
    }
    const input = manifest;
    const version = input.version;
    if (version !== 1) {
        throw new Error('Unsupported Organigram wallet manifest version.');
    }
    const domain = normalizeHost(requireString(input.domain, 'manifest domain'));
    if (domain !== normalizeHost(servingHost)) {
        throw new Error('Organigram wallet manifest domain does not match host.');
    }
    const signInChallengeUrl = requireString(input.signInChallengeUrl, 'signInChallengeUrl');
    const parsedChallengeUrl = requireHttpsUrl(signInChallengeUrl, 'signInChallengeUrl');
    if (!isHostCompatibleWithDomain({
        host: parsedChallengeUrl.host,
        domain
    })) {
        throw new Error('Organigram wallet manifest challenge URL must belong to its domain.');
    }
    const signInCompletionUrl = typeof input.signInCompletionUrl === 'string' &&
        input.signInCompletionUrl.trim() !== ''
        ? input.signInCompletionUrl.trim()
        : undefined;
    if (signInCompletionUrl != null) {
        const parsedCompletionUrl = requireHttpsUrl(signInCompletionUrl, 'signInCompletionUrl');
        if (!isHostCompatibleWithDomain({
            host: parsedCompletionUrl.host,
            domain
        })) {
            throw new Error('Organigram wallet manifest completion URL must belong to its domain.');
        }
    }
    return {
        version: 1,
        domain,
        signInChallengeUrl,
        ...(signInCompletionUrl == null ? {} : { signInCompletionUrl })
    };
};
/**
 * Read the domain of a Sign-In with Ethereum message from its first line.
 *
 * @param message - The message.
 * @throws When the first line is not a Sign-In with Ethereum header.
 */
export const resolveSiweDomain = (message) => {
    const [firstLine] = message.split('\n');
    const match = firstLine?.match(/^(.+?) wants you to sign in with your Ethereum account:$/);
    if (match?.[1] == null || match[1].trim() === '') {
        throw new Error('Unable to resolve SIWE domain from message.');
    }
    return normalizeHost(match[1]);
};
/**
 * Check that a Sign-In with Ethereum message is for the expected domain, before
 * signing it.
 *
 * @param message - The message.
 * @param expectedDomain - The domain of the request.
 * @throws When the domains differ.
 */
export const assertSignInDomainMatches = (message, expectedDomain) => {
    const actualDomain = resolveSiweDomain(message);
    const normalizedExpectedDomain = normalizeHost(expectedDomain);
    if (actualDomain !== normalizedExpectedDomain) {
        throw new Error(`SIWE domain mismatch: expected ${normalizedExpectedDomain}, received ${actualDomain}.`);
    }
};
