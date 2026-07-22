'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { createPasskeyWalletVaultPayload } from '@organigram/passkey-wallet'
import {
  createFetchPasskeyWalletApiClient,
  registerPasskeyCredentialEnvelope,
  type PasskeyWalletApiClient
} from '@organigram/passkey-wallet/webauthn-client'
import { organigramPasskeyWalletId } from '@organigram/passkey-wallet/rainbowkit'
import { getCsrfToken, signIn, signOut, useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mnemonicToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { sepolia } from 'wagmi/chains'

type DemoProvider = {
  request: (input: {
    method: string
    params?: readonly unknown[]
  }) => Promise<unknown>
}

type PasskeyCredentialItem = {
  credentialId: string
  userAddress: `0x${string}`
  name: string
  transports: string[]
  createdAt: string
  lastUsedAt: string | null
}

const defaultMessage = 'gm from Organigram Passkey Wallet'
const passkeyWalletApiBasePath = '/api/auth/passkey'
const passkeyRegistrationProxyBasePath = '/api/passkey-registration-proxy'
const passkeyWalletApi = createFetchPasskeyWalletApiClient(
  passkeyWalletApiBasePath
)
const normalizeDomain = (domain: string): string =>
  domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\./, '')
    .toLowerCase()

const normalizeApiBaseUrl = (apiBaseUrl: string): string =>
  apiBaseUrl.trim().replace(/\/+$/, '')

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)

const inferPasskeyDomainFromHostname = (hostname: string): string => {
  const normalizedHostname = normalizeDomain(hostname)
  if (normalizedHostname === '') {
    return ''
  }
  if (isLocalHostname(normalizedHostname)) {
    return normalizedHostname
  }

  const labels = normalizedHostname.split('.').filter(Boolean)
  const localLabelIndex = labels.indexOf('local')
  if (localLabelIndex >= 0 && labels.length - localLabelIndex > 2) {
    return labels.slice(localLabelIndex + 1).join('.')
  }

  return labels.length <= 2 ? normalizedHostname : labels.slice(-2).join('.')
}

const configuredPasskeyDomainOverride = normalizeDomain(
  process.env.NEXT_PUBLIC_CUSTOM_PASSKEY_DOMAIN ?? ''
)
const configuredPasskeyApiBaseUrlOverride = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_CUSTOM_PASSKEY_API_BASE_URL ?? ''
)

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const isHostCompatibleWithDomain = ({
  hostname,
  domain
}: {
  hostname: string
  domain: string
}): boolean => hostname === domain || hostname.endsWith(`.${domain}`)

const postPasskeyRegistrationProxy = async <T,>(
  targetBaseUrl: string,
  path: 'register/options' | 'register/verify',
  payload: Record<string, unknown>
): Promise<T> => {
  const response = await fetch(`${passkeyRegistrationProxyBasePath}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      targetBaseUrl,
      clientOrigin: window.location.origin,
      payload
    })
  })
  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & T)
    | null
  if (!response.ok) {
    throw new Error(
      body?.error ?? `Request failed with status ${response.status}`
    )
  }

  return body as T
}

const createRegistrationApiClient = (
  apiBaseUrl: string
): PasskeyWalletApiClient => {
  if (new URL(apiBaseUrl).origin === window.location.origin) {
    return createFetchPasskeyWalletApiClient(apiBaseUrl)
  }

  return {
    registerOptions: async input =>
      await postPasskeyRegistrationProxy(apiBaseUrl, 'register/options', input),
    registerVerify: async input =>
      await postPasskeyRegistrationProxy(apiBaseUrl, 'register/verify', input),
    unlockOptions: async () => {
      throw new Error('Remote unlock is not available through this demo proxy.')
    },
    unlockVerify: async () => {
      throw new Error('Remote unlock is not available through this demo proxy.')
    }
  }
}

export default function Home(): JSX.Element {
  const { address, chain, connector, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { data: siweSession, status: siweStatus } = useSession()
  const [message, setMessage] = useState(defaultMessage)
  const [seedPhrase, setSeedPhrase] = useState('')
  const [currentHostname, setCurrentHostname] = useState('')
  const [currentOrigin, setCurrentOrigin] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [exportedSeedPhrase, setExportedSeedPhrase] = useState<string | null>(
    null
  )
  const [backupCredentialId, setBackupCredentialId] = useState<string | null>(
    null
  )
  const [registeredCredentialId, setRegisteredCredentialId] = useState<
    string | null
  >(null)
  const [registeredAddress, setRegisteredAddress] = useState<
    `0x${string}` | null
  >(null)
  const [passkeys, setPasskeys] = useState<PasskeyCredentialItem[]>([])
  const [passkeyListAddress, setPasskeyListAddress] = useState<
    `0x${string}` | null
  >(null)
  const [serverPasskeys, setServerPasskeys] = useState<PasskeyCredentialItem[]>(
    []
  )
  const [status, setStatus] = useState('Connect with RainbowKit to begin.')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const siweSignInAddressRef = useRef<string | null>(null)

  const getProvider = async (): Promise<DemoProvider> => {
    if (connector == null || !('getProvider' in connector)) {
      throw new Error('Connect the passkey wallet first.')
    }

    return (await connector.getProvider()) as DemoProvider
  }

  const selectedAddress = address ?? registeredAddress

  const loadPasskeys = useCallback(
    async (walletAddress: `0x${string}`): Promise<void> => {
      const response = await fetch(
        `${passkeyWalletApiBasePath}/credentials?address=${walletAddress}`
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? 'Unable to load passkeys.')
      }

      const body = (await response.json()) as {
        credentials: PasskeyCredentialItem[]
      }
      setPasskeys(body.credentials)
      setPasskeyListAddress(walletAddress)
    },
    []
  )

  const loadServerPasskeys = useCallback(async (): Promise<void> => {
    const response = await fetch(`${passkeyWalletApiBasePath}/credentials`)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(body?.error ?? 'Unable to load server passkeys.')
    }

    const body = (await response.json()) as {
      credentials: PasskeyCredentialItem[]
    }
    setServerPasskeys(body.credentials)
  }, [])

  useEffect(() => {
    setCurrentHostname(window.location.hostname)
    setCurrentOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    loadServerPasskeys().catch(() => {
      setServerPasskeys([])
    })
  }, [loadServerPasskeys])

  useEffect(() => {
    if (selectedAddress == null) {
      setPasskeys([])
      setPasskeyListAddress(null)
      return
    }

    loadPasskeys(selectedAddress)
      .then(async () => {
        await loadServerPasskeys()
      })
      .catch(() => {
        setPasskeys([])
        setPasskeyListAddress(selectedAddress)
      })
  }, [loadPasskeys, loadServerPasskeys, selectedAddress])

  const currentPasskeyDomain =
    configuredPasskeyDomainOverride ||
    inferPasskeyDomainFromHostname(currentHostname)
  const currentPasskeyApiBaseUrl =
    configuredPasskeyApiBaseUrlOverride ||
    (currentPasskeyDomain === ''
      ? ''
      : isLocalHostname(currentPasskeyDomain)
        ? `${currentOrigin}${passkeyWalletApiBasePath}`
        : `https://${currentPasskeyDomain}${passkeyWalletApiBasePath}`)
  const displayedPasskeyDomain =
    currentPasskeyDomain === ''
      ? 'Not inferred from current host'
      : currentPasskeyDomain
  const displayedPasskeyApiBaseUrl =
    currentPasskeyApiBaseUrl === ''
      ? 'Not inferred until a domain is available'
      : currentPasskeyApiBaseUrl

  const runWalletAction = async (
    nextStatus: string,
    action: () => Promise<void>
  ): Promise<void> => {
    setIsBusy(true)
    setError(null)
    setStatus(nextStatus)

    try {
      await action()
    } catch (actionError) {
      setError(formatError(actionError))
    } finally {
      setIsBusy(false)
    }
  }

  const signInWithSiwe = async ({
    walletAddress,
    chainId,
    provider
  }: {
    walletAddress: `0x${string}`
    chainId?: number
    provider?: DemoProvider
  }): Promise<void> => {
    const nonce = await getCsrfToken()
    if (nonce == null || nonce === '') {
      throw new Error('Unable to get a SIWE nonce from NextAuth.')
    }

    const message = createSiweMessage({
      domain: window.location.host,
      address: walletAddress,
      statement: 'Sign in to the local Passkey Wallet demo.',
      uri: window.location.origin,
      version: '1',
      chainId: chainId ?? chain?.id ?? sepolia.id,
      nonce
    })
    const signer = provider ?? (await getProvider())
    const signature = await signer.request({
      method: 'personal_sign',
      params: [message, walletAddress]
    })
    const result = await signIn('credentials', {
      message,
      redirect: false,
      signature: String(signature)
    })

    if (result?.ok !== true || result.error != null) {
      throw new Error(result?.error ?? 'SIWE sign-in failed.')
    }

    siweSignInAddressRef.current = walletAddress
  }

  const connectWithWagmi = async (): Promise<void> => {
    await runWalletAction('Connecting directly with Wagmi...', async () => {
      const passkeyConnector = connectors.find(
        candidate => candidate.id === organigramPasskeyWalletId
      )
      if (passkeyConnector == null) {
        throw new Error('The passkey wallet connector is not available.')
      }

      const connection = await connectAsync({
        connector: passkeyConnector,
        chainId: sepolia.id
      })
      const [connectedAddress] = connection.accounts
      if (connectedAddress == null) {
        throw new Error('Wagmi did not return a connected wallet address.')
      }

      await signInWithSiwe({
        walletAddress: connectedAddress,
        chainId: connection.chainId,
        provider: (await passkeyConnector.getProvider()) as DemoProvider
      })
      setStatus('Connected through Wagmi and signed in with SIWE.')
    })
  }

  const toggleWagmiConnection = async (): Promise<void> => {
    if (isConnected) {
      await runWalletAction('Disconnecting wallet...', async () => {
        await disconnectAsync()
        await signOut({ redirect: false })
        siweSignInAddressRef.current = null
        setStatus('Disconnected from Wagmi.')
      })
      return
    }

    await connectWithWagmi()
  }

  useEffect(() => {
    if (
      !isConnected ||
      address == null ||
      connector?.id !== organigramPasskeyWalletId ||
      siweStatus !== 'unauthenticated' ||
      isBusy ||
      siweSignInAddressRef.current?.toLowerCase() === address.toLowerCase()
    ) {
      return
    }

    runWalletAction('Signing in with SIWE...', async () => {
      await signInWithSiwe({ walletAddress: address })
      setStatus('Connected through RainbowKit and signed in with SIWE.')
    })
  }, [address, connector?.id, isBusy, isConnected, siweStatus])

  useEffect(() => {
    if (isConnected || siweStatus !== 'authenticated') {
      return
    }

    siweSignInAddressRef.current = null
    signOut({ redirect: false }).catch(() => {})
  }, [isConnected, siweStatus])

  const createSeedPhraseEoaPasskey = async (): Promise<void> => {
    await runWalletAction('Creating local passkey...', async () => {
      const normalizedSeedPhrase = seedPhrase.trim().replace(/\s+/g, ' ')
      if (normalizedSeedPhrase === '') {
        throw new Error('Enter the seed phrase to protect with a passkey.')
      }

      const account = mnemonicToAccount(normalizedSeedPhrase)
      const vaultPayload =
        await createPasskeyWalletVaultPayload(normalizedSeedPhrase)
      const credential = await registerPasskeyCredentialEnvelope({
        api: passkeyWalletApi,
        address: account.address,
        vaultPayload,
        name: 'Seed phrase EOA passkey'
      })

      setRegisteredAddress(credential.address)
      setRegisteredCredentialId(credential.credentialId)
      await loadPasskeys(credential.address)
      await loadServerPasskeys()
      setStatus('Local passkey created and stored by the demo API.')
    })
  }

  const getCurrentSeedPhrase = async (): Promise<string> => {
    const typedSeedPhrase = seedPhrase.trim().replace(/\s+/g, ' ')
    if (typedSeedPhrase !== '') {
      return typedSeedPhrase
    }
    if (exportedSeedPhrase != null && exportedSeedPhrase.trim() !== '') {
      return exportedSeedPhrase.trim().replace(/\s+/g, ' ')
    }
    if (!isConnected) {
      throw new Error(
        'Enter a seed phrase or connect a passkey wallet before registering.'
      )
    }

    const provider = await getProvider()
    const result = await provider.request({
      method: 'organigram_exportSeedPhrase'
    })
    return String(result).trim().replace(/\s+/g, ' ')
  }

  const registerCurrentWalletWithCurrentDomain = async (): Promise<void> => {
    await runWalletAction('Registering current wallet...', async () => {
      if (!window.isSecureContext) {
        throw new Error('Open the demo in a secure browser context first.')
      }
      const targetDomain = currentPasskeyDomain
      const apiBaseUrl = currentPasskeyApiBaseUrl
      if (targetDomain === '') {
        throw new Error(
          'Open the demo from the target domain or one of its subdomains before registering.'
        )
      }
      if (apiBaseUrl === '') {
        throw new Error(
          'Configure a registration API base URL before registering.'
        )
      }
      if (
        !isHostCompatibleWithDomain({
          hostname: window.location.hostname,
          domain: targetDomain
        })
      ) {
        throw new Error(
          'Open this local demo from the target domain or one of its subdomains, for example demo.local.organigram.ai for organigram.ai.'
        )
      }
      const apiUrl = new URL(apiBaseUrl)
      if (
        !isHostCompatibleWithDomain({
          hostname: apiUrl.hostname,
          domain: targetDomain
        })
      ) {
        throw new Error(
          'The registration API host must match the target domain.'
        )
      }

      const currentSeedPhrase = await getCurrentSeedPhrase()
      const account = mnemonicToAccount(currentSeedPhrase)
      const vaultPayload =
        await createPasskeyWalletVaultPayload(currentSeedPhrase)
      const credential = await registerPasskeyCredentialEnvelope({
        api: createRegistrationApiClient(apiBaseUrl),
        address: account.address,
        vaultPayload,
        name: `${targetDomain} passkey`
      })

      setRegisteredAddress(credential.address)
      setRegisteredCredentialId(credential.credentialId)
      if (apiUrl.origin === window.location.origin) {
        await loadPasskeys(credential.address)
        await loadServerPasskeys()
      }
      setStatus(`Passkey registered with ${targetDomain}.`)
    })
  }

  const signMessage = async (): Promise<void> => {
    await runWalletAction('Waiting for passkey signature...', async () => {
      const provider = await getProvider()
      const result = await provider.request({
        method: 'personal_sign',
        params: [message, address]
      })
      setSignature(String(result))
      setStatus('Message signed with the passkey-backed EOA.')
    })
  }

  const addBackupPasskey = async (): Promise<void> => {
    await runWalletAction('Registering a backup passkey...', async () => {
      const provider = await getProvider()
      const result = (await provider.request({
        method: 'organigram_addPasskey',
        params: [{ name: 'Backup passkey' }]
      })) as { credentialId?: string }
      setBackupCredentialId(result.credentialId ?? 'registered')
      if (address != null) {
        await loadPasskeys(address)
      }
      await loadServerPasskeys()
      setStatus('Backup passkey registered for the same wallet address.')
    })
  }

  const deletePasskey = async ({
    credentialId,
    userAddress
  }: {
    credentialId: string
    userAddress: `0x${string}`
  }): Promise<void> => {
    await runWalletAction('Deleting passkey...', async () => {
      const response = await fetch(`${passkeyWalletApiBasePath}/credentials`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: userAddress,
          credentialId
        })
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? 'Unable to delete passkey.')
      }

      if (backupCredentialId === credentialId) {
        setBackupCredentialId(null)
      }
      if (passkeyListAddress != null) {
        await loadPasskeys(passkeyListAddress)
      }
      await loadServerPasskeys()
      setStatus('Passkey deleted.')
    })
  }

  const sendDummyTransaction = async (): Promise<void> => {
    await runWalletAction(
      'Sending a 0 ETH Sepolia self-transfer...',
      async () => {
        if (address == null) {
          throw new Error(
            'Connect a passkey wallet before sending a transaction.'
          )
        }
        const provider = await getProvider()
        const result = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: address,
              value: 0n
            }
          ]
        })
        setTransactionHash(String(result))
        setStatus('Sepolia transaction submitted.')
      }
    )
  }

  const exportSeedPhrase = async (): Promise<void> => {
    await runWalletAction('Unlocking seed phrase export...', async () => {
      const provider = await getProvider()
      const result = await provider.request({
        method: 'organigram_exportSeedPhrase'
      })
      setExportedSeedPhrase(String(result))
      setStatus('Seed phrase exported after passkey verification.')
    })
  }

  return (
    <main className='shell'>
      <header className='topbar'>
        <div className='brand'>
          <img
            className='brand-logo'
            src='/png/logo-gradient.png'
            width={36}
            height={36}
            alt=''
            aria-hidden='true'
          />
          <div>
            <p className='brand-title'>Organigram Passkey Wallet</p>
            <p className='brand-subtitle'>
              Next + Wagmi + RainbowKit + SIWE demo
            </p>
          </div>
        </div>
        <button
          className='button secondary header-action'
          disabled={isBusy}
          onClick={() => {
            toggleWagmiConnection()
          }}
        >
          {isConnected ? 'Disconnect' : 'Connect wallet'}
        </button>
      </header>

      <section className='page-grid'>
        <div className='intro'>
          <h1>Connect, unlock, and sign with a passkey wallet.</h1>
          <p>
            This small demo app wires the headless passkey wallet into
            RainbowKit, shows direct Wagmi connection, creates an authenticated
            server-side session, and can convert an existing mnemonic-backed EOA
            into a passkey-protected vault. You can also use it to register to
            external domains who support the wallet API.
          </p>
        </div>

        <div className='wallet-actions-column'>
          <aside className='panel wallet-card wallet-actions-card'>
            <h2>Wallet actions</h2>
            <p>
              Use either connector first. The first connection creates a wallet
              if no passkey exists; later connections unlock the same encrypted
              vault.
            </p>
            <textarea
              className='message-box'
              value={message}
              onChange={event => {
                setMessage(event.target.value)
              }}
              aria-label='Message to sign'
              suppressHydrationWarning
            />
            <div className='button-row'>
              <button
                className='button'
                disabled={!isConnected || isBusy}
                onClick={() => {
                  signMessage()
                }}
              >
                Sign message
              </button>
              <button
                className='button secondary'
                disabled={!isConnected || isBusy}
                onClick={() => {
                  sendDummyTransaction()
                }}
              >
                Send 0 ETH Sepolia tx
              </button>
            </div>
          </aside>

          <aside className='status-panel wallet-info-panel' aria-live='polite'>
            <h2>Wallet info</h2>
            <div className='status-row'>
              <div className='status-label'>Connection</div>
              <div
                className={
                  isConnected ? 'status-value success' : 'status-value'
                }
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <div className='status-row'>
              <div className='status-label'>Chain</div>
              <div className='status-value'>
                {chain == null ? 'Not selected' : `${chain.name} (${chain.id})`}
              </div>
            </div>
            <div className='status-row'>
              <div className='status-label'>SIWE</div>
              <div
                className={
                  siweStatus === 'authenticated'
                    ? 'status-value success'
                    : 'status-value'
                }
              >
                {siweStatus === 'authenticated'
                  ? 'Signed in as ' + siweSession?.user?.name
                  : 'Signed out'}
              </div>
            </div>
            <div className='status-row'>
              <div className='status-label'>Status</div>
              <div className='status-value'>{status}</div>
            </div>
            {error != null ? (
              <div className='status-row'>
                <div className='status-label'>Error</div>
                <div className='status-value error'>{error}</div>
              </div>
            ) : null}
            {signature != null ? (
              <div className='status-row'>
                <div className='status-label'>Signature</div>
                <div className='status-value'>{signature}</div>
              </div>
            ) : null}
            {transactionHash != null ? (
              <div className='status-row'>
                <div className='status-label'>Transaction</div>
                <div className='status-value'>{transactionHash}</div>
              </div>
            ) : null}
            {backupCredentialId != null ? (
              <div className='status-row'>
                <div className='status-label'>Backup passkey</div>
                <div className='status-value'>{backupCredentialId}</div>
              </div>
            ) : null}
            {registeredAddress != null ? (
              <div className='status-row'>
                <div className='status-label'>Registered EOA</div>
                <div className='status-value'>{registeredAddress}</div>
              </div>
            ) : null}
            {registeredCredentialId != null ? (
              <div className='status-row'>
                <div className='status-label'>Registered credential</div>
                <div className='status-value'>{registeredCredentialId}</div>
              </div>
            ) : null}
          </aside>

          <aside className='panel wallet-card server-passkeys-card'>
            <h2>Server registered passkeys</h2>
            <p>
              Passkeys persisted by the demo back-end, independent of the EOA
              currently selected in the wallet connector.
            </p>
            {!isLocalHostname(currentHostname) ? (
              'Server-side records are only available on localhost.'
            ) : serverPasskeys.length > 0 ? (
              <div className='passkey-list'>
                {serverPasskeys.map(passkey => (
                  <div
                    className='passkey-item'
                    key={`server-${passkey.credentialId}`}
                  >
                    <div>
                      <strong>{passkey.name}</strong>
                      <span>
                        {new Date(passkey.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                    <span>EOA {passkey.userAddress}</span>
                    <code>{passkey.credentialId}</code>
                  </div>
                ))}
              </div>
            ) : (
              <div className='empty-state'>
                'No passkeys registered on this demo server yet.'
              </div>
            )}
            <p className='field-note'>
              Local credentials are persisted in{' '}
              <code>.passkey-wallet-store/store.json</code>. The file contains
              WebAuthn public keys and encrypted vaults, never seed phrases.
            </p>
          </aside>
        </div>

        <div className='passkeys-column'>
          <aside className='panel wallet-card passkeys-card'>
            <h2>Passkeys for this EOA</h2>
            <p>
              This section lists the passkey credentials used for the connected
              address.
            </p>
            {passkeys.length > 0 ? (
              <div className='passkey-list'>
                {passkeys.map(passkey => (
                  <div className='passkey-item' key={passkey.credentialId}>
                    <div>
                      <strong>{passkey.name}</strong>
                      <span>
                        {new Date(passkey.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                    <span>EOA {passkey.userAddress}</span>
                    <code>{passkey.credentialId}</code>
                    <span>
                      {passkey.transports.length > 0
                        ? passkey.transports.join(', ')
                        : 'No transports reported'}
                    </span>
                    <button
                      className='button secondary danger'
                      disabled={
                        isBusy ||
                        passkeys.filter(
                          item =>
                            item.userAddress.toLowerCase() ===
                            passkey.userAddress.toLowerCase()
                        ).length <= 1
                      }
                      onClick={() => {
                        deletePasskey({
                          credentialId: passkey.credentialId,
                          userAddress: passkey.userAddress
                        })
                      }}
                    >
                      Delete passkey
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className='empty-state'>
                Connect or import an EOA to see its local passkeys.
              </div>
            )}
            <div className='button-row'>
              <button
                className='button secondary'
                disabled={!isConnected || isBusy}
                onClick={() => {
                  addBackupPasskey()
                }}
              >
                Add backup passkey
              </button>
              <button
                className='button secondary'
                disabled={!isConnected || isBusy}
                onClick={() => {
                  exportSeedPhrase()
                }}
              >
                Export seed
              </button>
            </div>
            {exportedSeedPhrase != null ? (
              <div className='seed-phrase-box'>
                <strong>Seed phrase</strong>
                <code>{exportedSeedPhrase}</code>
              </div>
            ) : null}
          </aside>

          <aside className='panel wallet-card current-domain-card'>
            <h2>Register to a custom domain</h2>
            <p>
              You can start this app and visit a target domain or subdomain
              pointing to <code>127.0.0.1</code> (for example:{' '}
              <code>local.organigram.ai</code>) to register the current EOA as a
              valid account for this domain.
            </p>
            <label className='field-group'>
              <span className='control-label'>Current passkey domain</span>
              <input
                className='text-input'
                value={displayedPasskeyDomain}
                disabled
                suppressHydrationWarning
              />
            </label>
            <label className='field-group'>
              <span className='control-label'>Current registration API</span>
              <input
                className='text-input'
                value={displayedPasskeyApiBaseUrl}
                disabled
                suppressHydrationWarning
              />
            </label>
            {currentPasskeyDomain === '' ? (
              <p className='field-note'>
                Open this demo from the target domain or one of its subdomains
                before registering.
              </p>
            ) : null}
            <p>
              This will register the connected wallet to the app servers using
              the correct domain RP ID without exposing the seed phrase. It will
              create a new passkey and send the vault encrypted for persistence
              on the domain servers. The seed never leaves the browser.
            </p>
            <button
              className='button'
              disabled={
                isBusy ||
                (seedPhrase.trim() === '' &&
                  exportedSeedPhrase == null &&
                  !isConnected) ||
                currentPasskeyDomain === '' ||
                currentPasskeyApiBaseUrl === ''
              }
              onClick={() => {
                registerCurrentWalletWithCurrentDomain()
              }}
            >
              Register current wallet
            </button>
          </aside>
        </div>

        <div className='connection-import-column'>
          <aside className='panel wallet-card connection-card'>
            <h2>Connection actions</h2>
            <p>
              Connect wallet via RainbowKit or Wagmi. Both paths also sign into
              the demo app by signing a message via the SIWE NextAuth provider
              under the hood.
            </p>
            <div className='button-row'>
              <div className='action-control'>
                <span className='control-label'>With RainbowKit</span>
                <div className='rainbowkit-action'>
                  <ConnectButton showBalance={false} />
                </div>
              </div>
              <div className='action-control'>
                <span className='control-label'>Wagmi only</span>
                <button
                  className='button secondary'
                  disabled={isBusy}
                  onClick={() => {
                    toggleWagmiConnection()
                  }}
                >
                  {isConnected ? 'Disconnect' : 'Connect wallet'}
                </button>
              </div>
            </div>
          </aside>

          <aside className='panel wallet-card import-card'>
            <h2>Import EOA</h2>
            <p>
              Paste a vanilla EOA seed phrase. The app derives its address,
              encrypts a wallet vault, and asks WebAuthn to protect it with a
              new passkey.
            </p>
            <textarea
              className='message-box seed-box'
              value={seedPhrase}
              onChange={event => {
                setSeedPhrase(event.target.value)
              }}
              aria-label='Seed phrase to import'
              placeholder='twelve or twenty four word seed phrase'
              suppressHydrationWarning
            />
            <div className='button-row'>
              <button
                className='button secondary'
                disabled={isBusy || seedPhrase.trim() === ''}
                onClick={() => {
                  createSeedPhraseEoaPasskey()
                }}
              >
                Create passkey
              </button>
            </div>
            <p className='warning-text'>
              Never paste a real seed phrase into a remote website. This is
              acceptable for a local example you control, but production apps
              should avoid asking users to reveal seed phrases in a web page.
            </p>
          </aside>
        </div>
      </section>
    </main>
  )
}
