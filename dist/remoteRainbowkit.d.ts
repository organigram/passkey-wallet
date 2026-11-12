import type { Wallet } from '@rainbow-me/rainbowkit';
import { type PasskeyWalletConnectResult, type PasskeyWalletSignMessageResult, type PasskeyWalletSignTypedDataResult, type PasskeyWalletSendTransactionResult, type PasskeyWalletTransaction, type PasskeyWalletTypedData } from './remoteProtocol';
/**
 * Identifier of the wagmi connector of the wallet, `organigramPasskeyWalletId`.
 */
export declare const organigramRemotePasskeyWalletId = "organigram-passkeys";
/**
 * A connection to the wallet remembered in the local storage of the app.
 *
 * @remarks
 * It only holds the public address and chain, never a key: every signature
 * still asks the user in the wallet popup.
 */
export type OrganigramRemotePasskeyWalletConnection = {
    /** Version of the format. */
    version: 1;
    /** Connected address. */
    address: `0x${string}`;
    /** Connected chain. */
    chainId: number;
    /** ISO 8601 date of the connection. */
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
/** Input of `createOrganigramRemotePasskeyWallet()`. */
export type CreateOrganigramRemotePasskeyWalletInput = {
    /**
     * Origin of the wallet, `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL` or
     * `https://localhost:3002` by default.
     */
    walletOrigin?: string;
    /** Replace the connect request to the wallet popup, for example in tests. */
    requestConnect?: RemoteRequestConnect;
    /** Replace the sign message request to the wallet popup. */
    requestPersonalSign?: RemoteRequestPersonalSign;
    /** Replace the sign typed data request to the wallet popup. */
    requestSignTypedData?: RemoteRequestSignTypedData;
    /** Replace the send transaction request to the wallet popup. */
    requestSendTransaction?: RemoteRequestSendTransaction;
};
/** An address already known to the app, for example from its session. */
export type HydrateOrganigramRemoteWalletConnectionInput = {
    /** The address. */
    address: `0x${string}`;
    /** Its chain. */
    chainId?: number;
};
/** A wagmi connector, identified by its `id`. */
export type HydrateOrganigramRemoteWalletConnectionConnector = {
    /** Identifier of the connector. */
    id: string;
};
/** Input of `hydrateOrganigramRemoteWalletConnection()`. */
export type HydrateOrganigramRemoteWalletConnectionOptions<TConnector extends HydrateOrganigramRemoteWalletConnectionConnector> = HydrateOrganigramRemoteWalletConnectionInput & {
    /** wagmi connectors of the app. */
    connectors: readonly TConnector[];
    /** wagmi `connectAsync`. */
    connectAsync: (input: {
        connector: TConnector;
    }) => Promise<unknown>;
    /** Chain used when the input has none, Sepolia (11155111) by default. */
    defaultChainId?: number;
};
/**
 * Read the remembered connection to the wallet.
 *
 * @returns The connection, or `null` if none is valid.
 */
export declare const getOrganigramRemotePasskeyWalletConnection: () => OrganigramRemotePasskeyWalletConnection | null;
/**
 * Remember a connection to the wallet in local storage.
 *
 * @param input - The connected address and chain.
 */
export declare const rememberOrganigramRemotePasskeyWalletConnection: ({ address, chainId }: {
    address: `0x${string}`;
    chainId: number;
}) => void;
/** Forget the remembered connection to the wallet. */
export declare const clearOrganigramRemotePasskeyWalletConnection: () => void;
/**
 * Connect wagmi to the wallet for an address the app already knows, without
 * opening the wallet popup.
 *
 * @remarks
 * Remembers the connection, then connects the wallet connector, which restores
 * it. If connecting fails, the connection is forgotten.
 * @param options - The address and chain, and the wagmi connectors and
 * `connectAsync`.
 */
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
/**
 * Create the RainbowKit wallet of the passkey wallet, which opens the wallet in
 * a popup.
 *
 * @remarks
 * The connector exposes an EIP-1193 provider. Account and signing requests open
 * the wallet popup, and every signature is checked against the connected
 * address and chain. Other JSON-RPC requests go to the default RPC URL of the
 * active chain.
 * @param input - The origin of the wallet, and replacements of its requests.
 * @example
 * ```ts
 * const connectors = connectorsForWallets(
 *   [{ groupName: 'Organigram', wallets: [() => createOrganigramRemotePasskeyWallet()] }],
 *   { appName: 'My app', projectId }
 * )
 * ```
 */
export declare const createOrganigramRemotePasskeyWallet: ({ walletOrigin, requestConnect, requestPersonalSign, requestSignTypedData, requestSendTransaction }?: CreateOrganigramRemotePasskeyWalletInput) => Wallet;
export {};
