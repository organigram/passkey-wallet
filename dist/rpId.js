export const isLocalHostname = (hostname) => hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
export const normalizeHostname = (hostname) => typeof hostname === 'string'
    ? hostname.trim().replace(/^\./, '').toLowerCase()
    : '';
const knownMultiLabelPublicSuffixes = [
    'vercel.app',
    'pages.dev',
    'netlify.app',
    'web.app'
];
const inferKnownPlatformRpId = (hostname) => {
    for (const suffix of knownMultiLabelPublicSuffixes) {
        if (hostname === suffix)
            return hostname;
        if (!hostname.endsWith(`.${suffix}`))
            continue;
        const labels = hostname.split('.').filter(Boolean);
        const suffixLabels = suffix.split('.');
        const rpIdLabelCount = suffixLabels.length + 1;
        return labels.length <= rpIdLabelCount
            ? hostname
            : labels.slice(-rpIdLabelCount).join('.');
    }
};
const isKnownPublicSuffix = (hostname) => knownMultiLabelPublicSuffixes.includes(hostname);
export const inferPasskeyRpId = (hostname) => {
    const normalizedHostname = normalizeHostname(hostname);
    if (normalizedHostname === '' || isLocalHostname(normalizedHostname)) {
        return normalizedHostname;
    }
    const platformRpId = inferKnownPlatformRpId(normalizedHostname);
    if (platformRpId != null)
        return platformRpId;
    const labels = normalizedHostname.split('.').filter(Boolean);
    const localLabelIndex = labels.indexOf('local');
    if (localLabelIndex >= 0 && labels.length - localLabelIndex > 2) {
        return labels.slice(localLabelIndex + 1).join('.');
    }
    return labels.length <= 2 ? normalizedHostname : labels.slice(-2).join('.');
};
export const isHostnameCompatibleWithRpId = ({ hostname, rpId }) => {
    const normalizedHostname = normalizeHostname(hostname);
    const normalizedRpId = normalizeHostname(rpId);
    if (normalizedHostname === '' || normalizedRpId === '')
        return false;
    if (isLocalHostname(normalizedHostname) || isLocalHostname(normalizedRpId)) {
        return (isLocalHostname(normalizedHostname) && isLocalHostname(normalizedRpId));
    }
    if (isKnownPublicSuffix(normalizedRpId))
        return false;
    return (normalizedHostname === normalizedRpId ||
        normalizedHostname.endsWith(`.${normalizedRpId}`));
};
