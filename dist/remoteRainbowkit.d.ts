import type { Wallet } from '@rainbow-me/rainbowkit';
import { type PasskeyWalletConnectResult, type PasskeyWalletSignMessageResult, type PasskeyWalletSignTypedDataResult, type PasskeyWalletSendTransactionResult, type PasskeyWalletTransaction, type PasskeyWalletTypedData } from './remoteProtocol';
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
type RemoteRequestSignTypedData = (input: {
    address: `0x${string}`;
    chainId: number;
    typedData: PasskeyWalletTypedData;
}) => Promise<PasskeyWalletSignTypedDataResult>;
type RemoteRequestSendTransaction = (input: {
    address: `0x${string}`;
    chainId: number;
    transaction: PasskeyWalletTransaction;
}) => Promise<PasskeyWalletSendTransactionResult>;
export type CreateOrganigramRemotePasskeyWalletInput = {
    walletOrigin?: string;
    requestConnect?: RemoteRequestConnect;
    requestPersonalSign?: RemoteRequestPersonalSign;
    requestSignTypedData?: RemoteRequestSignTypedData;
    requestSendTransaction?: RemoteRequestSendTransaction;
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
export declare const hydrateOrganigramRemoteWalletConnection: <TConnector extends HydrateOrganigramRemoteWalletConnectionConnector>({ address, chainId, connectAsync, connectors, defaultChainId }: HydrateOrganigramRemoteWalletConnectionOptions<TConnector>) => Promise<void>;
/**
 * Adds presentation-only context to the next wallet approvals. This lets an
 * app tell the wallet that one user action requires several signatures,
 * without broadening any approval or altering its signed payload.
 */
export declare const beginOrganigramWalletApprovalSequence: ({ count, label }: {
    count: number;
    label?: string;
}) => (() => void);
export declare const createOrganigramRemotePasskeyWallet: ({ walletOrigin, requestConnect, requestPersonalSign, requestSignTypedData, requestSendTransaction }?: CreateOrganigramRemotePasskeyWalletInput) => Wallet;
export {};
