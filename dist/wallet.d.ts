import type { OrganigramPasskeyCapabilities, UnlockedPasskeyWallet } from './types';
import { type PasskeyWalletVaultPayload } from './vault';
export declare const unlockedPasskeyWalletTtlMs: number;
export declare const createUnlockedPasskeyWallet: ({ address, credentialId, vaultPayload, now }: {
    address: `0x${string}`;
    credentialId: string;
    vaultPayload: PasskeyWalletVaultPayload;
    now?: number;
}) => UnlockedPasskeyWallet;
export declare const createNewPasskeyWalletVault: ({ capabilities }: {
    capabilities: OrganigramPasskeyCapabilities;
}) => Promise<{
    address: `0x${string}`;
    vaultPayload: PasskeyWalletVaultPayload;
}>;
