export const normalizeHost = (domain) => domain.trim().toLowerCase().replace(/\.$/, '');
export const requireString = (value, field) => {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Organigram wallet ${field} is required.`);
    }
    return value.trim();
};
