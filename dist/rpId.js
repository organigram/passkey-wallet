export const isLocalHostname = (hostname) => hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
export const normalizeHostname = (hostname) => typeof hostname === 'string'
    ? hostname.trim().replace(/^\./, '').toLowerCase()
    : '';
export const inferPasskeyRpId = (hostname) => {
    const normalizedHostname = normalizeHostname(hostname);
    if (normalizedHostname === '' || isLocalHostname(normalizedHostname)) {
        return normalizedHostname;
    }
    const labels = normalizedHostname.split('.').filter(Boolean);
    const localLabelIndex = labels.indexOf('local');
    if (localLabelIndex >= 0 && labels.length - localLabelIndex > 2) {
        return labels.slice(localLabelIndex + 1).join('.');
    }
    return labels.length <= 2 ? normalizedHostname : labels.slice(-2).join('.');
};
export const isHostnameCompatibleWithRpId = ({ hostname, rpId }) => (isLocalHostname(hostname) && isLocalHostname(rpId)) ||
    hostname === rpId ||
    hostname.endsWith(`.${rpId}`);
