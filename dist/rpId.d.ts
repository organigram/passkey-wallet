export declare const isLocalHostname: (hostname: string) => boolean;
export declare const normalizeHostname: (hostname: unknown) => string;
export declare const inferPasskeyRpId: (hostname: string) => string;
export declare const isHostnameCompatibleWithRpId: ({ hostname, rpId }: {
    hostname: string;
    rpId: string;
}) => boolean;
