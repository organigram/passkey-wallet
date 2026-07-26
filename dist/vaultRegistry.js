export const formatAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;
export const formatCredentialId = (credentialId) => credentialId.length <= 18
    ? credentialId
    : `${credentialId.slice(0, 8)}...${credentialId.slice(-6)}`;
export const mergeVaults = (localVaults, importedVaults) => {
    const vaults = new Map();
    localVaults.forEach(vault => vaults.set(vault.credentialId, vault));
    importedVaults.forEach(vault => vaults.set(vault.credentialId, vault));
    return Array.from(vaults.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};
export const groupVaultsByWallet = (vaults) => {
    const groups = new Map();
    vaults.forEach(vault => {
        vault.accounts.forEach(account => {
            const key = account.address.toLowerCase();
            const existingGroup = groups.get(key);
            if (existingGroup == null) {
                groups.set(key, {
                    address: account.address,
                    name: account.name,
                    addressIndex: account.addressIndex,
                    derivationPath: account.derivationPath,
                    passkeys: [vault]
                });
                return;
            }
            existingGroup.passkeys.push(vault);
        });
    });
    return Array.from(groups.values()).sort((left, right) => left.addressIndex - right.addressIndex);
};
export const getVaultRegistryGroupId = (vault) => vault.accounts
    .map(account => `${account.addressIndex}:${account.address.toLowerCase()}`)
    .sort()
    .join('|');
export const groupVaultRecordsBySeed = (vaults) => {
    const groups = new Map();
    vaults.forEach(vault => {
        const id = getVaultRegistryGroupId(vault);
        const existingGroup = groups.get(id);
        if (existingGroup == null) {
            groups.set(id, {
                id,
                accounts: [...vault.accounts].sort((left, right) => left.addressIndex - right.addressIndex),
                passkeys: [vault],
                createdAt: vault.createdAt
            });
            return;
        }
        existingGroup.passkeys.push(vault);
        if (vault.createdAt.localeCompare(existingGroup.createdAt) < 0) {
            existingGroup.createdAt = vault.createdAt;
        }
    });
    return Array.from(groups.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};
export const getVaultAccount = (vault, address) => vault.accounts.find(account => account.address.toLowerCase() === address.toLowerCase()) ?? null;
export const getNextAddressIndex = (records) => Math.max(-1, ...records.flatMap(record => record.accounts.map(account => account.addressIndex))) + 1;
