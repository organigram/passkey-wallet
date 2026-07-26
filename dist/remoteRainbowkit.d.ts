import type { Wallet } from '@rainbow-me/rainbowkit';
import { type PasskeyWalletConnectResult, type PasskeyWalletSignMessageResult } from './remoteProtocol';
export declare const organigramRemotePasskeyWalletId = "organigram-passkeys";
export type OrganigramRemotePasskeyWalletConnection = {
    version: 1;
    address: `0x${string}`;
    chainId: number;
    connectedAt: string;
};
type RemoteRequestConnect = (input: {
    chainId: number;
}) => Promise<PasskeyWalletConnectResult>;
type RemoteRequestPersonalSign = (input: {
    address: `0x${string}`;
    chainId: number;
    message: string;
}) => Promise<PasskeyWalletSignMessageResult>;
export type CreateOrganigramRemotePasskeyWalletInput = {
    walletOrigin?: string;
    requestConnect?: RemoteRequestConnect;
    requestPersonalSign?: RemoteRequestPersonalSign;
};
export type HydrateOrganigramRemoteWalletConnectionInput = {
    address: `0x${string}`;
    chainId?: number;
};
export type HydrateOrganigramRemoteWalletConnectionConnector = {
    id: string;
};
export type HydrateOrganigramRemoteWalletConnectionOptions<TConnector extends HydrateOrganigramRemoteWalletConnectionConnector> = HydrateOrganigramRemoteWalletConnectionInput & {
    connectors: readonly TConnector[];
    connectAsync: (input: {
        connector: TConnector;
    }) => Promise<unknown>;
    defaultChainId?: number;
};
export declare const getOrganigramRemotePasskeyWalletConnection: () => OrganigramRemotePasskeyWalletConnection | null;
export declare const rememberOrganigramRemotePasskeyWalletConnection: ({ address, chainId }: {
    address: `0x${string}`;
    chainId: number;
}) => void;
export declare const clearOrganigramRemotePasskeyWalletConnection: () => void;
export declare const notifyOrganigramRemotePasskeyWalletDisconnect: ({ walletOrigin, address, chainId }: {
    walletOrigin?: string;
    address: `0x${string}`;
    chainId: number;
}) => void;
export declare const hydrateOrganigramRemoteWalletConnection: <TConnector extends HydrateOrganigramRemoteWalletConnectionConnector>({ address, chainId, connectAsync, connectors, defaultChainId }: HydrateOrganigramRemoteWalletConnectionOptions<TConnector>) => Promise<void>;
export declare const createOrganigramRemotePasskeyWallet: ({ walletOrigin, requestConnect, requestPersonalSign }?: CreateOrganigramRemotePasskeyWalletInput) => Wallet;
export {};
