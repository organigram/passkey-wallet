/** Origin of the official Organigram passkey wallet. */
export declare const officialWalletOrigin = "https://wallet.organigram.ai";
/**
 * Origin of the local copy of the official wallet.
 *
 * @remarks
 * A wallet can have a local copy: the same wallet run on the user's own
 * machine, served under a subdomain of the wallet host, so that it unlocks the
 * same passkeys. An app that trusts the wallet then also trusts that copy.
 * The official wallet's copy is `pnpm dev local-organigram`; another
 * deployment declares its own through `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_LOCAL_URL`.
 */
export declare const officialLocalWalletOrigin = "https://local.wallet.organigram.ai:3002";
/** Posted by the local copy's request page as soon as it loads. */
export declare const passkeyWalletReadyType = "organigram:wallet:ready";
/** Posted by a wallet before it hands a request to its local copy. */
export declare const passkeyWalletLocalHandoffType = "organigram:wallet:local-handoff";
/** Asks a wallet to serve a request itself. */
export declare const localWalletOptOutParam = "localWallet";
/** Only an HTTPS subdomain of the wallet host can unlock its passkeys. */
export declare const isLocalWalletOriginOf: (localWalletOrigin: string, walletOrigin: string) => boolean;
/** The local copy of `walletOrigin`, if it has one. */
export declare const getLocalWalletOrigin: (walletOrigin: string) => string | null;
/** The origins whose messages an app expecting `walletOrigin` accepts. */
export declare const getAcceptedWalletOrigins: (walletOrigin: string) => string[];
/**
 * Opens requests on the local copy once it has answered on this device, so
 * that the official wallet is no longer loaded at all.
 */
export declare const toPreferredWalletUrl: (url: URL) => URL;
/** Remembers which of the accepted origins answered for `walletOrigin`. */
export declare const rememberWalletOrigin: (walletOrigin: string, answeringOrigin: string) => void;
/**
 * Sends a message to the wallet popup, whichever accepted origin it shows:
 * the browser only delivers it to the one the popup is on.
 */
export declare const postToWalletPopup: (popup: Window, message: unknown, walletOrigin: string) => void;
/**
 * Brings the popup back to the wallet when its local copy does not answer,
 * for instance because it is not running. Returns the cleanup.
 */
export declare const watchLocalWalletPopup: ({ popup, popupUrl, walletOrigin, requestId, timeoutMs }: {
    popup: Window;
    popupUrl: URL;
    walletOrigin: string;
    requestId: string;
    timeoutMs?: number;
}) => (() => void);
