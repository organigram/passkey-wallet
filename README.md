# Organigram Passkey Wallet

**The ultimate web3 experience: unlock wallets and sign transactions with recoverable 
passkeys in a breeze.**

Organigram Passkey Wallet is a lightweight Ethereum wallet powered by
WebAuthn passkeys. It gives users the day-to-day experience they expect from
modern passwordless apps while preserving the core property that matters in
web3: fully and safely owning a standard Ethereum address.

No cumbersome smart account deployment. No per-network account ceremony. No
custodial key service. No protocol lock-in. Just a standard EOA, encrypted
client-side, unlocked with rotative passkeys, and exposed via Wagmi and Rainbowkit.

```sh
pnpm add @organigram/passkey-wallet
```

## Web3 identity, solved

Most web3 onboarding still asks users to understand browser extensions, seed
phrases, hardware devices, account abstraction, gas sponsorship, recovery
contracts, network-specific deployments, signer permissions... before they have
even used the product. Organigram Passkey Wallet takes a simpler path.

The user creates a wallet in the browser. The wallet is a normal Ethereum EOA
derived from a recovery phrase. That recovery phrase is encrypted locally with a
key derived from a WebAuthn passkey PRF output, then stored only as an encrypted
vault envelope. When the user returns, their passkey unlocks the vault and the
EOA signs messages or transactions like any other wallet.

The result is a wallet experience that feels native to the web:
- users unlock and sign with passkeys;
- multiple backup passkeys can be added to the same address;
- compromised or obsolete passkeys can be rotated;
- seed phrases can be exported for disaster prevention;
- encrypted backup vaults can be saved remotely or locally
- one address across every EVM network;
- standard EIP-1193 semantics for dapps;
- no onchain deployment required;
- no offchain signing relay or hosted signer to trust.

## Highlights

### Unlock and sign with passkeys

Users unlock the wallet with a WebAuthn passkey. Once unlocked, the wallet signs
messages, typed data, and transactions with the underlying EOA.

### A fully-fledged Ethereum wallet

The wallet exposes the same interface dapps already expect from injected wallets,
WalletConnect wallets, and RainbowKit connectors. It supports account
requests, chain switching, message signing, typed data signing, and transaction
submission like any other standard wallet.

### Multiple backup keys, one address

Users can add additional passkeys for the same address. A backup phone, laptop,
password manager, or security key can unlock the same encrypted wallet vault.

### No smart-account deployment burden

The address is a standard EOA, so it exists everywhere EVM accounts exist. There
is no need to deploy account contracts across networks before the user can start.

### Seed phrase export

Passkeys optimize daily use, while the capacity to export seed phrases preserves portability and gives users a disaster prevention path for the case where every passkey is lost.

### Recoverable vaults

The app exports an encrypted vault that can be saved to and restored from anywhere.
Use remote servers, save locally or in a password manager without fear to leak
sensitive information. 

## Wallet UI

This package builds a production-ready app used to serve the wallet locally or on custom domains. 

```sh
pnpm dev
pnpm build:artifact
```

`build:artifact` builds the TypeScript library to `app-dist`, and packages a deterministic
`artifacts/passkey-wallet-app-v<version>.tar.gz` with a `.sha256` checksum and
manifest.

### Local development

`pnpm dev` serves the wallet at `https://localhost:3002`, behind an HTTPS proxy
in front of Vite (port 3003). The first run creates a local certificate with
[mkcert](https://github.com/FiloSottile/mkcert).

Any other hostname can be passed as an argument (`pnpm dev my.host.test`): the
certificate is regenerated to include it.

### Run your own wallet

You do not have to trust the servers of wallet.organigram.ai, nor the code they
serve, to use your Organigram accounts. The `local-organigram` profile serves
your own copy of the wallet, built from this source code, on your machine:

```sh
pnpm dev local-organigram
```

(or `pnpm passkey-wallet dev local-organigram` from the repository root), then
open `https://local.wallet.organigram.ai:3002`.

`local.wallet.organigram.ai` is a subdomain of `wallet.organigram.ai`, so this
copy unlocks the same passkeys, hence the same accounts: the profile sets the
passkey RP ID to `wallet.organigram.ai`. Its browser storage is separate, so
restore your encrypted vault there once (see [Recoverable vaults](#recoverable-vaults)):
your passkey then unlocks it as usual. Your keys never leave your browser, and
signing in no longer depends on wallet.organigram.ai being online or unaltered.

The name already resolves to `127.0.0.1` through public DNS, so no setup is
needed. For a stronger guarantee, also resolve it in your hosts file: a tampered
DNS record could otherwise send it to a server able to request the PRF output of
your passkeys (macOS and Linux):

```sh
grep -q 'local.wallet.organigram.ai' /etc/hosts || echo '127.0.0.1 local.wallet.organigram.ai' | sudo tee -a /etc/hosts
```

To use it from any app, turn on **Settings → Your own wallet** on
wallet.organigram.ai. Requests then go to your copy, and once it has answered,
apps open it directly: wallet.organigram.ai is no longer loaded at all. If your
copy stops answering, for instance because it is not running, the request goes
back to wallet.organigram.ai after a few seconds.

Apps that use this package accept the local copy of the official wallet without
any setting, on their pages and on their wallet endpoints (sign-in challenge,
vault backups, RPC).

A wallet deployed elsewhere can offer the same to its users with its own local
copy, served under a subdomain of its host so that it unlocks the same passkeys:

- the deployment declares it with `localWalletOrigin` in
  `passkey-wallet.config.json` (or `PASSKEY_WALLET_LOCAL_WALLET_ORIGIN` at build
  time), for example `https://local.wallet.example.com:3002`;
- users run it with
  `PASSKEY_WALLET_PASSKEY_RP_ID=wallet.example.com pnpm dev local.wallet.example.com`;
- apps accept it with `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_LOCAL_URL`, next to
  `NEXT_PUBLIC_ORGANIGRAM_PASSKEY_WALLET_URL`. The value is ignored unless it is
  an HTTPS subdomain of the wallet host.

Each production build of https://wallet.organigram.ai is published as a
release of this repository, with the SHA-256 of every served file. To check
that the live wallet serves one of these releases unchanged, run from a clone
of this repository:

```sh
node scripts/verify-runtime-dist.mjs --url https://wallet.organigram.ai
```

With Node.js 24 and pnpm 10.28, rebuilding a release commit reproduces its files:

```sh
pnpm install --frozen-lockfile
pnpm run build
node scripts/verify-runtime-dist.mjs --dist app-dist --manifest <release manifest>
```


## Architecture

```txt
Browser
  WebAuthn passkey with PRF
        |
        v
  HKDF-derived vault key
        |
        v
  AES-GCM encrypted wallet vault envelope
        |
        v
  Recovery phrase -> EOA -> EIP-1193 provider

Server
  WebAuthn challenges
  Credential public keys
  Credential counters
  Encrypted vault envelopes
```

In practice, the flow is:

1. Generate a recovery phrase in the browser.
2. Derive a standard Ethereum EOA from that phrase.
3. Create a WebAuthn passkey with `residentKey: "required"`,
   `userVerification: "required"`, and the `prf` extension.
4. Derive a vault encryption key from the PRF output and a random salt.
5. Encrypt the wallet vault with AES-GCM.
6. Store only the credential metadata and encrypted vault envelope server-side.
7. On unlock, verify WebAuthn, recover the PRF output, decrypt the envelope, and
   expose the EOA through EIP-1193.

The private wallet material is generated and decrypted in the browser. The server
stores only WebAuthn verification material and encrypted vault envelopes. The
server never needs the seed phrase, the private key, or the decrypted user vault.

## Quick Start

Create and unlock vaults in the UI with wallet
helpers:

```ts
import {
  createGeneratedRecoveryPhrase,
  registerBrowserPasskeyVault,
  unlockBrowserPasskeyVault
} from '@organigram/passkey-wallet/browser-wallet'

const registration = await registerBrowserPasskeyVault({
  recoveryPhrase: createGeneratedRecoveryPhrase(),
  name: 'Account 1'
})

const unlocked = await unlockBrowserPasskeyVault({
  records: [registration.record]
})

const signature = await unlocked.wallet.account.signMessage({
  message: 'gm'
})
```

The passkey ceremony and vault decryption happen in the wallet origin. Dapps
should integrate through the remote connector.

## RainbowKit Integration

```ts
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import {
  createOrganigramRemotePasskeyWallet
} from '@organigram/passkey-wallet/remote-rainbowkit'

const passkeyWallet = createOrganigramRemotePasskeyWallet({
  walletOrigin: 'https://wallet.organigram.ai'
})

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: connectorsForWallets(
    [
      {
        groupName: 'Recommended',
        wallets: [() => passkeyWallet]
      }
    ],
    {
      appName: 'Your App',
      projectId: 'walletconnect-project-id'
    }
  ),
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http()
  }
})
```

From the dapp's perspective, this behaves like a wallet. Calling
`personal_sign`, `eth_signTypedData_v4`, or `eth_sendTransaction` goes through
the wallet origin, where the user approves the request.

## Server Responsibilities

The wallet app is static. A server is optional and should only receive encrypted
backup packages or dapp sign-in challenges. It should not create WebAuthn
credentials, unlock vaults, or receive decrypted wallet material.

## Backup Keys And Rotation

A passkey wallet should never depend on a single authenticator.

Organigram Passkey Wallet supports adding another passkey to the same wallet by
re-encrypting the same vault payload for a new credential. The address does not
change. The user can keep using the same EOA while adding a laptop passkey, a
phone passkey, a password manager passkey, or a hardware security key.

Rotation is the same idea in reverse: remove obsolete credentials only when
another recovery method remains. The package gives you the wallet and envelope
building blocks; your product should decide the UX policy for deletion,
confirmation, and minimum backup requirements.

## Recovery

Passkeys make daily wallet use simple, but users still need an escape hatch.

Organigram Passkey Wallet keeps the wallet portable by deriving the EOA from a
standard recovery phrase. If every passkey is lost, the user can recover the
account with the seed phrase, or use it in any other wallet.

The recovery phrase should always be exported **before** the user loses all passkeys.
The package provides a helper to export a seed phrase after a successful
WebAuthn ceremony, but cannot do so after all access to the vault is lost.

## Security Model

Organigram Passkey Wallet is non-custodial by design.

The browser creates the wallet. The browser encrypts the vault. The browser
decrypts the vault after a successful WebAuthn ceremony. The server stores
encrypted envelopes and verifies that WebAuthn responses are valid for the
expected challenge, origin, RP ID, and credential public key.

This model assumes:

- WebAuthn PRF support is required for the passkey vault flow;
- the host app serves the wallet UI from a trustworthy origin;
- the server correctly expires and consumes challenges;
- the server verifies credential counters and user verification;
- recovery phrase export is treated as a sensitive operation;
- backup passkey deletion never leaves the user without a recovery method;
- a compromised browser session can read unlocked wallet material while a
  request is being processed.

### Passkey scope

Passkeys are created for the exact hostname serving the wallet (for example
`wallet.organigram.ai`). Any page served under the passkey RP ID can request
the PRF output that decrypts the vault, so no other application should be
hosted under it. Dapps never need the wallet RP ID: they reach the wallet
through its popup and `postMessage`.

A wallet served from a subdomain can reuse the passkeys of its parent wallet
host by setting `passkeyRpId` in `passkey-wallet.config.json` (or
`PASSKEY_WALLET_PASSKEY_RP_ID`) to that host. The value must be the current
hostname or one of its parent domains. `pnpm dev local-organigram` does so for
`wallet.organigram.ai` (see [Run your own wallet](#run-your-own-wallet)).

The wallet sends a `Content-Security-Policy` that forbids third-party scripts
and any framing of the wallet origin.

## Browser Compatibility

The passkey vault depends on the WebAuthn `prf` extension. Browsers or password
managers that do not return PRF output cannot unlock the encrypted vault.

Apps should present a clear fallback when PRF is unavailable:

- retry with another passkey provider;
- use a platform authenticator that supports PRF;
- connect an external crypto wallet instead.

## What This Is Not

Organigram Passkey Wallet is not a smart account framework. It does not require
4337 infrastructure, paymasters, bundlers, module registries, or per-chain
deployments.

It is not a custodial wallet. The server does not receive the recovery phrase or
private key in clear text.

It is not a hosted wallet service. The package is open source; the
host app owns persistence, authentication, and backup policy.

It is not a replacement for hardware wallets in high-assurance custody flows. It
is designed for the safest mainstream web UX possible while staying portable and
EVM-compatible.

## License

MIT
