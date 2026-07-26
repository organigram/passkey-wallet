const passkeyDeviceKinds = new Set([
    'macos',
    'ios',
    'ipados',
    'windows',
    'android',
    'linux',
    'security-key',
    'cross-device',
    'platform',
    'passkey'
]);
const isPasskeyDevice = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const device = value;
    return (typeof device.kind === 'string' &&
        passkeyDeviceKinds.has(device.kind) &&
        typeof device.label === 'string' &&
        device.label.trim() !== '');
};
const isStoredVaultAccount = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const account = value;
    return (typeof account.address === 'string' &&
        /^0x[a-fA-F0-9]{40}$/.test(account.address) &&
        typeof account.name === 'string' &&
        typeof account.addressIndex === 'number' &&
        Number.isInteger(account.addressIndex) &&
        account.addressIndex >= 0 &&
        typeof account.derivationPath === 'string' &&
        account.derivationPath !== '');
};
export const isStoredVaultRecord = (value) => {
    if (typeof value !== 'object' || value == null)
        return false;
    const record = value;
    return (record.version === 1 &&
        typeof record.address === 'string' &&
        /^0x[a-fA-F0-9]{40}$/.test(record.address) &&
        Array.isArray(record.accounts) &&
        record.accounts.length > 0 &&
        record.accounts.every(isStoredVaultAccount) &&
        typeof record.credentialId === 'string' &&
        record.credentialId !== '' &&
        typeof record.name === 'string' &&
        Array.isArray(record.transports) &&
        isPasskeyDevice(record.passkeyDevice) &&
        typeof record.createdAt === 'string' &&
        (record.lastUsedAt == null || typeof record.lastUsedAt === 'string') &&
        typeof record.envelope === 'object' &&
        record.envelope != null);
};
export const parseVaultRegistry = (value) => {
    if (typeof value !== 'object' || value == null) {
        throw new Error('Vault registry must be a JSON object.');
    }
    const registry = value;
    if (registry.version !== 1 || !Array.isArray(registry.vaults)) {
        throw new Error('Unsupported vault registry format.');
    }
    return {
        version: 1,
        vaults: registry.vaults.filter(isStoredVaultRecord)
    };
};
export const createVaultRegistry = (vaults) => ({
    version: 1,
    vaults
});
export const serializeVaultRegistry = (vaults, space = 2) => `${JSON.stringify(createVaultRegistry(vaults), null, space)}\n`;
export const vaultHasAccount = (vault, address) => vault.accounts.some(account => account.address.toLowerCase() === address.toLowerCase());
export const upsertVaultRecord = ({ vaults, record }) => [
    record,
    ...vaults.filter(vault => vault.credentialId !== record.credentialId)
];
export const addAccountToVaultRecords = ({ vaults, sourceAddress, account }) => vaults.map(vault => vaultHasAccount(vault, sourceAddress)
    ? {
        ...vault,
        accounts: vaultHasAccount(vault, account.address)
            ? vault.accounts
            : [...vault.accounts, account].sort((left, right) => left.addressIndex - right.addressIndex)
    }
    : vault);
export const removeVaultRecord = ({ vaults, credentialId }) => vaults.filter(vault => vault.credentialId !== credentialId);
export const removeVaultRecords = ({ vaults, credentialIds }) => vaults.filter(vault => !credentialIds.has(vault.credentialId));
export const removeAccountFromVaultRecords = ({ vaults, address }) => vaults
    .map(vault => ({
    ...vault,
    accounts: vault.accounts.filter(account => account.address.toLowerCase() !== address.toLowerCase())
}))
    .filter(vault => vault.accounts.length > 0);
export const markVaultRecordUsed = ({ vaults, credentialId, usedAt = new Date().toISOString() }) => vaults.map(vault => vault.credentialId === credentialId
    ? {
        ...vault,
        lastUsedAt: usedAt
    }
    : vault);
