import type { Chain, EIP1193RequestFn } from 'viem';
import type { PasskeyProviderEvent, PasskeyProviderListener, PasskeyRegistrationResult, UnlockedPasskeyWallet } from './types';
export type OrganigramPasskeyProvider = {
    request: EIP1193RequestFn;
    on: (event: PasskeyProviderEvent, listener: PasskeyProviderListener) => void;
    removeListener: (event: PasskeyProviderEvent, listener: PasskeyProviderListener) => void;
};
export type OrganigramPasskeyProviderActions = {
    registerAdditionalPasskeyCredential: (input: {
        wallet: UnlockedPasskeyWallet;
        name?: string;
    }) => Promise<PasskeyRegistrationResult>;
    exportPasskeyWalletRecoveryPhrase: (input: {
        expectedAddress: `0x${string}`;
    }) => Promise<string>;
};
export declare const createPasskeyWalletProvider: ({ wallet, chain, rpcUrl, switchChain, actions }: {
    wallet: UnlockedPasskeyWallet;
    chain: Chain;
    rpcUrl: string;
    switchChain: (chainId: number) => Chain;
    actions: OrganigramPasskeyProviderActions;
}) => OrganigramPasskeyProvider;
export declare const normalizePasskeyWalletAddress: (address: `0x${string}`) => `0x${string}`;
