# Organigram Passkey Wallet Next + RainbowKit Example

Minimal Next template showing how to use the passkey wallet package with Wagmi
and RainbowKit.

The example demonstrates:

- RainbowKit connection with the passkey wallet;
- direct Wagmi connection with `useConnect`;
- automatic SIWE sign-in through NextAuth after connecting the passkey wallet;
- passkey-backed wallet creation and unlock through WebAuthn;
- importing a vanilla EOA seed phrase into a passkey-protected vault;
- registering the current wallet directly with the current passkey domain;
- listing the passkeys stored locally for the connected or registered EOA;
- `personal_sign` through the EIP-1193 provider;
- adding a backup passkey, then deleting any non-last passkey from the local
  demo store;
- exporting the seed phrase;
- sending a 0 ETH Sepolia self-transfer if the passkey address is funded.

## Run locally

From this directory:

```sh
pnpm install
pnpm cert
pnpm dev
```

Open `https://localhost:3000`.

`pnpm dev` is self-contained for this example. It generates a trusted
`mkcert` certificate in `certificates/` when needed, starts Next on
`127.0.0.1:3001`, and exposes the app through a local HTTPS proxy on port
`3000`. The generated certificates are ignored by git.

The script sets these defaults unless you override them in `.env.local`:

```txt
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=passkey-wallet-demo-local-secret
PASSKEY_WALLET_RP_NAME=Passkey Wallet Example
PASSKEY_WALLET_DEMO_HTTPS_PORT=3000
PASSKEY_WALLET_DEMO_NEXT_PORT=3001
PASSKEY_WALLET_DEMO_LISTEN_HOST=127.0.0.1
PASSKEY_WALLET_DEMO_CERTIFICATE_NAME=local-passkey-wallet
```

Copy `.env.example` to `.env.local` only if you want to override these values.
The only required system dependency is `mkcert`.

```sh
brew install mkcert nss
```

Passkeys require a secure browser context and this wallet flow requires Passkey PRF
support. If your browser or password manager does not return PRF output,
try another authenticator such as a platform passkey, Chrome profile passkey, or
hardware security key.

## SIWE + NextAuth

The demo includes a minimal NextAuth credentials provider at
`/api/auth/[...nextauth]`. After connecting the passkey wallet with RainbowKit
or direct Wagmi, the app signs a SIWE message with the passkey-backed EOA. The
server verifies the signature, domain, and nonce, then stores only the signed
address in the local NextAuth session.

This is intentionally optional. It demonstrates how a host app can bind an app
session to the EOA before local registration, but it does not change WebAuthn
scoping: a passkey created on `localhost` is still scoped to `localhost`.

## Local Demo Persistence

The local API persists registered credentials to
`.passkey-wallet-store/store.json` in the example directory. That makes
`Register current wallet` visible across page refreshes and dev server restarts
on `localhost`.

The file contains credential IDs, WebAuthn public keys, counters, transports,
addresses, and encrypted vault envelopes. It does not contain seed phrases or
decrypted wallet material. The file is ignored by git. Delete it to reset the
local demo store.

## Create Domain Passkeys Locally

Passkeys created on `localhost` are scoped to `localhost`. To create a passkey
with another WebAuthn RP ID, run the same local demo through that domain or one
of its subdomains, then use the `Register current wallet` card. That action
calls the configured registration API, so passkey creation and database
registration happen in the same WebAuthn ceremony. The user does not choose the
RP ID in the browser; the API chooses it in the WebAuthn options it returns, and
the browser enforces that the current page origin is compatible.
The demo infers the target domain from the current hostname. For example,
`local.organigram.ai` or `demo.local.organigram.ai` is inferred as
`organigram.ai`.

For a fixed local demo hostname, point it at your machine:

```txt
127.0.0.1 local.organigram.ai
::1 local.organigram.ai
```

Then start the local-domain server from this example directory:

```sh
PASSKEY_WALLET_DEMO_HOST=local.organigram.ai pnpm dev
```

Open `https://local.organigram.ai:3000`, not `https://localhost:3000`.
The script generates a certificate valid for `local.organigram.ai`,
`localhost`, `127.0.0.1`, and `::1`, then serves the demo through the local
HTTPS proxy. If the browser still says the site is not secure, rerun
`pnpm cert` and make sure `mkcert -install` completed successfully for your
browser trust store. The shared certificate is
`certificates/local-passkey-wallet.pem`, valid for `localhost`, `127.0.0.1`,
`::1`, and `local.organigram.ai`.
The server should verify that the request origin is compatible with the RP ID,
and store the exact expected origin and RP ID in each challenge before verifying
the passkey response.

The local demo API still stores credentials in memory. `Create passkey` uses
that local API, so it creates a passkey for the current local host. `Register
current wallet` derives the target API as
`https://<inferred-domain>/api/auth/passkey`. The card displays the inferred
values in disabled fields so the user can verify the target without changing it.
For remote targets, browser requests are relayed through the local demo server
at `/api/passkey-registration-proxy/*`. That keeps the browser same-origin while
the local server forwards the original WebAuthn origin to the target API. This
avoids an opaque browser `Failed to fetch` after a passkey has already been
created but before the target server stores it.

The action verifies that the page is open from the inferred domain or one of its
subdomains, asks the target API for a challenge, creates a new passkey for the
server-selected RP ID, and submits the WebAuthn response plus encrypted vault
back for storage. It uses the seed phrase typed in the import form when present;
otherwise it asks the connected wallet to export its seed phrase after passkey
verification.

For another local hostname, run:

```sh
PASSKEY_WALLET_DEMO_HOST=demo.local.example.com pnpm dev
```

The certificate is generated for that host plus the local aliases. You still
need the hostname to resolve to this machine through DNS or `/etc/hosts`.
By default the HTTPS proxy listens on `127.0.0.1`, so custom hostnames should
resolve to `127.0.0.1`.

A passkey cannot be re-scoped after it has been created. Registering the current
wallet creates a new passkey for the same seed phrase and derived EOA; it does
not copy or submit an already-created localhost passkey.

`PASSKEY_WALLET_RP_NAME` controls the label shown by the browser during local
WebAuthn ceremonies. Integrations using their own domain should set this to
their product name and persist the generic `encryptedVault` registration
envelope field.

## Notes

This template intentionally keeps persistence minimal in `lib/passkey-store.ts`.
Credentials and encrypted vaults are persisted in a local JSON file; challenges
remain in memory and are consumed exactly once. A production app should persist
credential public keys, counters, and encrypted vault envelopes in a database,
consume challenges exactly once, and validate the expected origin/RP ID from its
deployment URL.

The import flow asks for a seed phrase, derives the standard EOA address
with `mnemonicToAccount`, creates a vault payload for that same phrase, then
registers a WebAuthn passkey envelope for the derived address. The phrase is
only used in the browser demo flow and should be treated as sensitive input.
It is acceptable for a local example you control; never paste a real seed phrase
into a remote website.

The server derives the expected origin from the request `Origin` header and
derives the RP ID from that origin's hostname. Localhost requests are accepted
across local dev ports when the RP ID is also local, so
`https://localhost:3001` works without extra origin or RP ID configuration.
Browsers reject WebAuthn registration when the page origin is not compatible
with the server-selected RP ID.

The local package dependency points to `file:..`. To keep the template small,
`next.config.mjs` aliases the browser crypto helpers to a local shim that
implements only what this wallet flow uses.
