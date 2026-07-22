# Organigram Passkey Wallet

**The ultimate web3 experience: unlock wallets and sign transactions with passkeys in a
breeze.**

Organigram Passkey Wallet is a lightweight, headless, EIP-1193 wallet powered by
WebAuthn passkeys. It gives users the day-to-day experience they expect from
modern passwordless apps while preserving the core property that matters in
web3: fully and safely owning a standard Ethereum address.

No cumbersome smart account deployment. No per-network account ceremony. No
custodial key service. No protocol lock-in. Just a standard EOA, encrypted
client-side, unlocked with rotative passkeys, and exposed through a wallet interface the
Ethereum ecosystem already understands.

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

- passkeys for everyday unlocks;
- standard EIP-1193 semantics for dapps;
- one address across every EVM network;
- multiple backup passkeys for the same address;
- seed phrase export for disaster recovery;
- no onchain deployment required;
- no offchain signing relay or hosted signer to trust.

## Highlights

### Unlock and sign with passkeys

Users unlock the wallet with a WebAuthn passkey. Once unlocked, the wallet signs
messages, typed data, and transactions with the underlying EOA.

### Fully-fledged EIP-1193 wallet

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

### Seed phrase recovery

Passkeys optimize daily use. Seed phrase export preserves portability and gives
users a disaster recovery path if every passkey is lost.

### Headless and open source

The package provides wallet, WebAuthn, vault, provider, and RainbowKit building
blocks. You own the product surface. No hosted signer, no mandatory backend
service, no strings attached.

## What You Get

Passkey Wallet is built for production UX:

- users unlock and sign with passkeys;
- backup passkeys can be added to the same address;
- compromised or obsolete passkeys can be rotated out by the host app;
- recovery phrases can be exported for disaster recovery;
- the same EOA works on every supported EVM chain without deploying anything;
- the package is headless, so product teams own the UI;
- all sensitive wallet material is encrypted client-side before persistence.

It is also intentionally boring where it should be boring: the address is a
standard EOA, the dapp integration is EIP-1193, the RainbowKit integration is a
wallet descriptor, and the WebAuthn server helpers are explicit about
registration, authentication, challenges, origins, RP IDs, counters, and vault
envelopes.

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

The passkey unlocks the local vault. The EOA signs Ethereum messages and
transactions. Those are separate responsibilities, which keeps the integration
simple and compatible with existing web3 infrastructure.

## Quick Start

Create a browser API client:

```ts
import {
  createFetchPasskeyWalletApiClient,
  unlockOrCreatePasskeyWallet
} from '@organigram/passkey-wallet/webauthn-client'
import { buildPasskeyWalletCapabilities } from '@organigram/passkey-wallet'

const api = createFetchPasskeyWalletApiClient('/api/auth/passkey')

const wallet = await unlockOrCreatePasskeyWallet({
  api,
  capabilities: buildPasskeyWalletCapabilities(),
  targetChainId: 1
})

const signature = await wallet.account.signMessage({
  message: 'gm'
})
```

That is the headless primitive. Most apps will wrap it in the RainbowKit adapter
below so the passkey wallet appears next to other connection methods.

## RainbowKit Integration

```ts
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { createOrganigramPasskeyWallet } from '@organigram/passkey-wallet/rainbowkit'
import {
  createFetchPasskeyWalletApiClient,
  unlockOrCreatePasskeyWallet,
  registerAdditionalPasskeyCredential,
  exportPasskeyWalletRecoveryPhrase
} from '@organigram/passkey-wallet/webauthn-client'

const api = createFetchPasskeyWalletApiClient('/api/auth/passkey')

const passkeyWallet = createOrganigramPasskeyWallet({
  unlockOrCreatePasskeyWallet: async input =>
    await unlockOrCreatePasskeyWallet({
      api,
      capabilities: input.capabilities,
      targetChainId: input.targetChainId
    }),
  registerAdditionalPasskeyCredential: async input =>
    await registerAdditionalPasskeyCredential({
      api,
      wallet: input.wallet,
      name: input.name
    }),
  exportPasskeyWalletRecoveryPhrase: async input =>
    await exportPasskeyWalletRecoveryPhrase({
      api,
      expectedAddress: input.expectedAddress
    })
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
the unlocked EOA account behind the passkey vault.

## Server Responsibilities

This package does not hide persistence behind a hosted service. Your app owns the
server boundary.

At minimum, store:

- short-lived WebAuthn challenges;
- credential IDs;
- credential public keys;
- credential transports;
- signature counters;
- the wallet address linked to each credential;
- encrypted vault envelopes for each credential.

Typical endpoints:

```txt
POST /api/auth/passkey/register/options
POST /api/auth/passkey/register/verify
POST /api/auth/passkey/unlock/options
POST /api/auth/passkey/unlock/verify
```

The server helpers generate WebAuthn options and verify responses, but your app
decides how to persist credentials, consume challenges, enforce origin/RP ID
rules, and link credentials to users.

## Suggested Data Model

The package does not require a specific database, but a production integration
usually needs records shaped like this:

```ts
type PasskeyCredential = {
  credentialId: string
  userAddress: `0x${string}`
  publicKey: string
  transports: string[]
  signCount: number
  createdAt: Date
  updatedAt: Date
}

type PasskeyVaultEnvelope = {
  credentialId: string
  userAddress: `0x${string}`
  encryptedVault: string
  salt: string
  nonce: string
  algorithm: string
  keyVersion: number
  createdAt: Date
}

type PasskeyChallenge = {
  challenge: string
  type: 'registration' | 'authentication'
  expiresAt: Date
  consumedAt?: Date
}
```

Use short challenge TTLs, consume challenges exactly once, and enforce uniqueness
for credential IDs.

`createPasskeyRegistrationOptions` accepts a configurable `rpName`:

```ts
const options = await createPasskeyRegistrationOptions({
  rpId: 'example.com',
  rpName: 'Example Wallet',
  userAddress
})
```

The registration envelope uses `encryptedVault` for the encrypted vault
ciphertext. API contracts should store and document the value as an encrypted
vault because the plaintext can contain more than a recovery phrase.

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
standard recovery phrase. If every passkey is lost, the user can recover with the
exported seed phrase in any compatible wallet. That is the difference between
passwordless convenience and platform lock-in.

The recovery phrase should always be exported before the user loses all passkeys.
The package provides a helper to export the recovery phrase after a successful
WebAuthn ceremony, but cannot do so after the access to the vault is lost.

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
- a compromised browser session can access unlocked wallet material while it is
  in memory.

The package avoids custodial recovery, hosted signing, and smart-account
dependency by keeping the encrypted EOA vault offchain and user-portable.

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

It is not a hosted wallet service. The package is open source and headless; the
host app owns persistence, authentication policy, UI, and deployment.

It is not a replacement for hardware wallets in high-assurance custody flows. It
is designed for the safest mainstream web UX possible while staying portable and
EVM-compatible.

## License

MIT
