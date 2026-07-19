import type { Wallet } from '@rainbow-me/rainbowkit';
import { type OrganigramPasskeyProviderActions } from './eip1193';
import { type OrganigramPasskeyCapabilities, type UnlockedPasskeyWallet } from './types';
export { organigramPasskeyWalletIcon, organigramPasskeyWalletId } from './types';
export declare const isOrganigramPasskeyConnector: ({ id }: {
    id: string;
}) => boolean;
export type CreateOrganigramPasskeyWalletInput = OrganigramPasskeyProviderActions & {
    unlockOrCreatePasskeyWallet: (input: {
        capabilities: OrganigramPasskeyCapabilities;
        targetChainId: number;
    }) => Promise<UnlockedPasskeyWallet>;
};
export declare const createOrganigramPasskeyWallet: ({ unlockOrCreatePasskeyWallet, registerAdditionalPasskeyCredential, exportPasskeyWalletRecoveryPhrase }: CreateOrganigramPasskeyWalletInput) => Wallet;
