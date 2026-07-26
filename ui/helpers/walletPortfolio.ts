import {
  createPublicClient,
  defineChain,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseGwei,
  type Chain,
  type Hex
} from 'viem'
import {
  arbitrum,
  arbitrumSepolia,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  celo,
  celoAlfajores,
  celoSepolia,
  fantom,
  fantomSonicTestnet,
  fantomTestnet,
  gnosis,
  gnosisChiado,
  holesky,
  linea,
  lineaSepolia,
  mantle,
  mantleSepoliaTestnet,
  mainnet,
  mode,
  modeTestnet,
  moonbeam,
  moonbaseAlpha,
  opBNB,
  opBNBTestnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  scroll,
  scrollSepolia,
  sepolia
} from 'viem/chains'

import type {
  GasPriority,
  PortfolioCurrency,
  PortfolioPeriod,
  TrackedWalletAsset,
  TrackedWalletAssetGroup,
  WalletNetworkKey
} from './wallet'
import { getWalletRuntimeConfig } from './runtimeConfig'

export const parseConfiguredChainId = (): number => {
  const value = getWalletRuntimeConfig().defaultChainId
  return Number.isInteger(value) && value > 0 ? value : sepolia.id
}

export const configuredChainId = parseConfiguredChainId()
export const configuredRpcUrl = getWalletRuntimeConfig().defaultRpcUrl.trim()
export const configuredRpcUrlTemplate =
  getWalletRuntimeConfig().rpcUrlTemplate.trim()
export const configuredRpcUrls = getWalletRuntimeConfig().rpcUrls

const getConfiguredRpcUrlFromTemplate = (chainId: number): string =>
  configuredRpcUrlTemplate === ''
    ? ''
    : configuredRpcUrlTemplate.replaceAll('{chainId}', chainId.toString())

export type WalletNetworkOption = {
  key: WalletNetworkKey
  label: string
  chain: Chain
  rpcUrl: string
  priceId?: string
  custom?: boolean
  testnet?: boolean
}

export type CustomWalletNetwork = {
  key: WalletNetworkKey
  label: string
  chainId: number
  rpcUrl: string
  nativeCurrencyName: string
  nativeCurrencySymbol: string
  nativeCurrencyDecimals: number
  priceId?: string
}

export type AddTrackedTokenAssetInput = {
  networkKey: WalletNetworkKey
  name: string
  symbol: string
  address: string
  decimals: string
  coingeckoId: string
}

export type AddCustomWalletNetworkInput = {
  name: string
  chainId: string
  rpcUrl: string
  currencyName: string
  currencySymbol: string
  currencyDecimals: string
  coingeckoId: string
}

export type CachedWalletBalance = {
  value: string
  fetchedAt: number
}

export type CachedWalletBalances = Record<string, CachedWalletBalance>

export const localChain = defineChain({
  id: 31337,
  name: 'Local Anvil',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH'
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545']
    }
  }
})

export const walletNetworkStorageKey = 'organigram.passkeyWallet.network'
export const showTestWalletNetworksStorageKey =
  'organigram.passkeyWallet.showTestNetworks'

export const getConfiguredRpcUrlForChain = (
  chain: Chain,
  fallbackRpcUrl = ''
): string => {
  const configuredRpcUrlForChain = configuredRpcUrls[String(chain.id)]?.trim()
  if (configuredRpcUrlForChain != null && configuredRpcUrlForChain !== '') {
    return configuredRpcUrlForChain
  }

  const templatedRpcUrl = getConfiguredRpcUrlFromTemplate(chain.id)
  if (templatedRpcUrl !== '') return templatedRpcUrl

  return configuredChainId === chain.id && configuredRpcUrl !== ''
    ? configuredRpcUrl
    : fallbackRpcUrl
}

export const builtinMainnetWalletNetworkOptions: WalletNetworkOption[] = [
  {
    key: 'mainnet',
    label: 'Ethereum Mainnet',
    chain: mainnet,
    rpcUrl: getConfiguredRpcUrlForChain(
      mainnet,
      'https://ethereum-rpc.publicnode.com'
    ),
    priceId: 'ethereum'
  },
  {
    key: 'base',
    label: 'Base',
    chain: base,
    rpcUrl: getConfiguredRpcUrlForChain(base),
    priceId: 'ethereum'
  },
  {
    key: 'arbitrum',
    label: 'Arbitrum One',
    chain: arbitrum,
    rpcUrl: getConfiguredRpcUrlForChain(arbitrum),
    priceId: 'ethereum'
  },
  {
    key: 'optimism',
    label: 'Optimism',
    chain: optimism,
    rpcUrl: getConfiguredRpcUrlForChain(optimism),
    priceId: 'ethereum'
  },
  {
    key: 'polygon',
    label: 'Polygon',
    chain: polygon,
    rpcUrl: getConfiguredRpcUrlForChain(polygon),
    priceId: 'polygon-ecosystem-token'
  },
  {
    key: 'bsc',
    label: 'BNB Smart Chain',
    chain: bsc,
    rpcUrl: getConfiguredRpcUrlForChain(bsc),
    priceId: 'binancecoin'
  },
  {
    key: 'avalanche',
    label: 'Avalanche C-Chain',
    chain: avalanche,
    rpcUrl: getConfiguredRpcUrlForChain(avalanche),
    priceId: 'avalanche-2'
  },
  {
    key: 'gnosis',
    label: 'Gnosis Chain',
    chain: gnosis,
    rpcUrl: getConfiguredRpcUrlForChain(gnosis),
    priceId: 'xdai'
  },
  {
    key: 'linea',
    label: 'Linea',
    chain: linea,
    rpcUrl: getConfiguredRpcUrlForChain(linea),
    priceId: 'ethereum'
  },
  {
    key: 'scroll',
    label: 'Scroll',
    chain: scroll,
    rpcUrl: getConfiguredRpcUrlForChain(scroll),
    priceId: 'ethereum'
  },
  {
    key: 'mantle',
    label: 'Mantle',
    chain: mantle,
    rpcUrl: getConfiguredRpcUrlForChain(mantle),
    priceId: 'mantle'
  },
  {
    key: 'mode',
    label: 'Mode',
    chain: mode,
    rpcUrl: getConfiguredRpcUrlForChain(mode),
    priceId: 'ethereum'
  },
  {
    key: 'opbnb',
    label: 'opBNB',
    chain: opBNB,
    rpcUrl: getConfiguredRpcUrlForChain(opBNB),
    priceId: 'binancecoin'
  },
  {
    key: 'celo',
    label: 'Celo',
    chain: celo,
    rpcUrl: getConfiguredRpcUrlForChain(celo),
    priceId: 'celo'
  },
  {
    key: 'fantom',
    label: 'Fantom Opera',
    chain: fantom,
    rpcUrl: getConfiguredRpcUrlForChain(fantom),
    priceId: 'fantom'
  },
  {
    key: 'moonbeam',
    label: 'Moonbeam',
    chain: moonbeam,
    rpcUrl: getConfiguredRpcUrlForChain(moonbeam),
    priceId: 'moonbeam'
  },
  {
    key: 'local',
    label: 'Local Anvil',
    chain: localChain,
    rpcUrl: getConfiguredRpcUrlForChain(localChain, 'http://127.0.0.1:8545'),
    testnet: true
  }
]

export const builtinTestWalletNetworkOptions: WalletNetworkOption[] = [
  {
    key: 'sepolia',
    label: 'Sepolia',
    chain: sepolia,
    rpcUrl: getConfiguredRpcUrlForChain(
      sepolia,
      'https://ethereum-sepolia-rpc.publicnode.com'
    ),
    testnet: true
  },
  {
    key: 'holesky',
    label: 'Holesky',
    chain: holesky,
    rpcUrl: getConfiguredRpcUrlForChain(
      holesky,
      'https://ethereum-holesky-rpc.publicnode.com'
    ),
    testnet: true
  },
  {
    key: 'base-sepolia',
    label: 'Base Sepolia',
    chain: baseSepolia,
    rpcUrl: getConfiguredRpcUrlForChain(baseSepolia),
    priceId: 'ethereum',
    testnet: true
  },
  {
    key: 'arbitrum-sepolia',
    label: 'Arbitrum Sepolia',
    chain: arbitrumSepolia,
    rpcUrl: getConfiguredRpcUrlForChain(arbitrumSepolia),
    priceId: 'ethereum',
    testnet: true
  },
  {
    key: 'optimism-sepolia',
    label: 'Optimism Sepolia',
    chain: optimismSepolia,
    rpcUrl: getConfiguredRpcUrlForChain(optimismSepolia),
    priceId: 'ethereum',
    testnet: true
  },
  {
    key: 'polygon-amoy',
    label: 'Polygon Amoy',
    chain: polygonAmoy,
    rpcUrl: getConfiguredRpcUrlForChain(polygonAmoy),
    priceId: 'polygon-ecosystem-token',
    testnet: true
  },
  {
    key: 'bsc-testnet',
    label: 'BNB Smart Chain Testnet',
    chain: bscTestnet,
    rpcUrl: getConfiguredRpcUrlForChain(bscTestnet),
    priceId: 'binancecoin',
    testnet: true
  },
  {
    key: 'avalanche-fuji',
    label: 'Avalanche Fuji',
    chain: avalancheFuji,
    rpcUrl: getConfiguredRpcUrlForChain(avalancheFuji),
    priceId: 'avalanche-2',
    testnet: true
  },
  {
    key: 'gnosis-chiado',
    label: 'Gnosis Chiado',
    chain: gnosisChiado,
    rpcUrl: getConfiguredRpcUrlForChain(gnosisChiado),
    priceId: 'xdai',
    testnet: true
  },
  {
    key: 'linea-sepolia',
    label: 'Linea Sepolia',
    chain: lineaSepolia,
    rpcUrl: getConfiguredRpcUrlForChain(lineaSepolia),
    priceId: 'ethereum',
    testnet: true
  },
  {
    key: 'scroll-sepolia',
    label: 'Scroll Sepolia',
    chain: scrollSepolia,
    rpcUrl: getConfiguredRpcUrlForChain(scrollSepolia),
    priceId: 'ethereum',
    testnet: true
  },
  {
    key: 'mantle-sepolia',
    label: 'Mantle Sepolia',
    chain: mantleSepoliaTestnet,
    rpcUrl: getConfiguredRpcUrlForChain(mantleSepoliaTestnet),
    priceId: 'mantle',
    testnet: true
  },
  {
    key: 'mode-testnet',
    label: 'Mode Testnet',
    chain: modeTestnet,
    rpcUrl: getConfiguredRpcUrlForChain(modeTestnet),
    priceId: 'ethereum',
    testnet: true
  },
  {
    key: 'opbnb-testnet',
    label: 'opBNB Testnet',
    chain: opBNBTestnet,
    rpcUrl: getConfiguredRpcUrlForChain(opBNBTestnet),
    priceId: 'binancecoin',
    testnet: true
  },
  {
    key: 'celo-alfajores',
    label: 'Celo Alfajores',
    chain: celoAlfajores,
    rpcUrl: getConfiguredRpcUrlForChain(celoAlfajores),
    priceId: 'celo',
    testnet: true
  },
  {
    key: 'celo-sepolia',
    label: 'Celo Sepolia',
    chain: celoSepolia,
    rpcUrl: getConfiguredRpcUrlForChain(celoSepolia),
    priceId: 'celo',
    testnet: true
  },
  {
    key: 'fantom-testnet',
    label: 'Fantom Testnet',
    chain: fantomTestnet,
    rpcUrl: getConfiguredRpcUrlForChain(fantomTestnet),
    priceId: 'fantom',
    testnet: true
  },
  {
    key: 'sonic-testnet',
    label: 'Sonic Testnet',
    chain: fantomSonicTestnet,
    rpcUrl: getConfiguredRpcUrlForChain(fantomSonicTestnet),
    priceId: 'fantom',
    testnet: true
  },
  {
    key: 'moonbase-alpha',
    label: 'Moonbase Alpha',
    chain: moonbaseAlpha,
    rpcUrl: getConfiguredRpcUrlForChain(moonbaseAlpha),
    priceId: 'moonbeam',
    testnet: true
  }
]

export const builtinWalletNetworkOptions: WalletNetworkOption[] = [
  ...builtinMainnetWalletNetworkOptions,
  ...builtinTestWalletNetworkOptions
]

export const customWalletNetworksStorageKey =
  'organigram.passkeyWallet.customNetworks'

export const isCustomWalletNetwork = (
  value: unknown
): value is CustomWalletNetwork => {
  if (typeof value !== 'object' || value == null) return false

  const network = value as Partial<CustomWalletNetwork>
  return (
    typeof network.key === 'string' &&
    network.key.startsWith('custom:') &&
    typeof network.label === 'string' &&
    network.label.trim() !== '' &&
    typeof network.chainId === 'number' &&
    Number.isInteger(network.chainId) &&
    network.chainId > 0 &&
    typeof network.rpcUrl === 'string' &&
    network.rpcUrl.trim() !== '' &&
    typeof network.nativeCurrencyName === 'string' &&
    network.nativeCurrencyName.trim() !== '' &&
    typeof network.nativeCurrencySymbol === 'string' &&
    network.nativeCurrencySymbol.trim() !== '' &&
    typeof network.nativeCurrencyDecimals === 'number' &&
    Number.isInteger(network.nativeCurrencyDecimals) &&
    network.nativeCurrencyDecimals >= 0 &&
    network.nativeCurrencyDecimals <= 36 &&
    (network.priceId == null || typeof network.priceId === 'string')
  )
}

export const getStoredCustomWalletNetworks = (): CustomWalletNetwork[] => {
  if (typeof window === 'undefined') return []

  const rawValue = window.localStorage.getItem(customWalletNetworksStorageKey)
  if (rawValue == null || rawValue === '') return []

  try {
    const parsed = JSON.parse(rawValue) as unknown
    return Array.isArray(parsed) ? parsed.filter(isCustomWalletNetwork) : []
  } catch {
    return []
  }
}

export const createCustomWalletNetworkOption = (
  network: CustomWalletNetwork
): WalletNetworkOption => ({
  key: network.key,
  label: network.label,
  custom: true,
  chain: defineChain({
    id: network.chainId,
    name: network.label,
    nativeCurrency: {
      decimals: network.nativeCurrencyDecimals,
      name: network.nativeCurrencyName,
      symbol: network.nativeCurrencySymbol
    },
    rpcUrls: {
      default: {
        http: [network.rpcUrl]
      }
    }
  }),
  rpcUrl: network.rpcUrl,
  priceId: network.priceId?.trim() === '' ? undefined : network.priceId
})

export const walletNetworkOptions: WalletNetworkOption[] = [
  ...builtinWalletNetworkOptions,
  ...getStoredCustomWalletNetworks().map(createCustomWalletNetworkOption)
]

export const getDefaultWalletNetworkKey = (): WalletNetworkKey => {
  return (
    walletNetworkOptions.find(option => option.chain.id === configuredChainId)
      ?.key ?? 'sepolia'
  )
}

export const getStoredWalletNetworkKey = (): WalletNetworkKey => {
  if (typeof window === 'undefined') return getDefaultWalletNetworkKey()

  const storedKey = window.localStorage.getItem(walletNetworkStorageKey)
  return walletNetworkOptions.some(option => option.key === storedKey)
    ? (storedKey as WalletNetworkKey)
    : getDefaultWalletNetworkKey()
}

export const getStoredShowTestWalletNetworks = (): boolean => {
  if (typeof window === 'undefined') return false

  return window.localStorage.getItem(showTestWalletNetworksStorageKey) === 'true'
}

export const walletBalanceNetworksStorageKey =
  'organigram.passkeyWallet.balanceNetworks'
export const trackedWalletAssetsStorageKey =
  'organigram.passkeyWallet.trackedAssets'
export const hiddenDefaultTrackedWalletAssetsStorageKey =
  'organigram.passkeyWallet.hiddenDefaultStablecoins.v1'
export const portfolioCurrencyStorageKey = 'organigram.passkeyWallet.currency'
export const walletBalancesStorageKey =
  'organigram.passkeyWallet.assetBalances'
export const walletBalanceCacheTtlMs = 2 * 60 * 1000
export const walletBalanceStaleFallbackTtlMs = 24 * 60 * 60 * 1000

export const portfolioCurrencies: PortfolioCurrency[] = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
  'HKD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'BRL',
  'MXN',
  'INR'
]
export const portfolioPeriods: { value: PortfolioPeriod; label: string }[] = [
  { value: '1', label: '1D' },
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '365', label: '1Y' }
]

export const isWalletNetworkKey = (value: unknown): value is WalletNetworkKey =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  (walletNetworkOptions.some(option => option.key === value) ||
    value.startsWith('custom:'))

export const getStoredWalletBalanceNetworkKeys = (): WalletNetworkKey[] => {
  const fallback = [getDefaultWalletNetworkKey()]
  if (typeof window === 'undefined') return fallback

  const rawValue = window.localStorage.getItem(walletBalanceNetworksStorageKey)
  if (rawValue == null || rawValue === '') return fallback

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) return fallback

    const keys = Array.from(new Set(parsed.filter(isWalletNetworkKey)))
    return keys.length === 0 ? fallback : keys
  } catch {
    return fallback
  }
}

export const getWalletNetworkOptionFrom = (
  options: WalletNetworkOption[],
  key: WalletNetworkKey
): WalletNetworkOption =>
  options.find(option => option.key === key) ??
  options.find(option => option.key === getDefaultWalletNetworkKey()) ??
  options[0]!

export const createWalletPublicClient = (option: WalletNetworkOption) =>
  createPublicClient({
    chain: option.chain,
    transport: http(option.rpcUrl || undefined)
  })

export const getNativeWalletAssets = (
  options: WalletNetworkOption[]
): TrackedWalletAsset[] =>
  options.map(option => ({
    id: `native:${option.key}`,
    type: 'native',
    networkKey: option.key,
    name: option.chain.nativeCurrency.name,
    symbol: option.chain.nativeCurrency.symbol,
    decimals: option.chain.nativeCurrency.decimals,
    coingeckoId: option.priceId ?? '',
    enabled: option.priceId != null
  }))

export const createDefaultStablecoinAsset = ({
  networkKey,
  name,
  symbol,
  tokenAddress,
  decimals,
  coingeckoId
}: {
  networkKey: WalletNetworkKey
  name: string
  symbol: string
  tokenAddress: `0x${string}`
  decimals: number
  coingeckoId: string
}): TrackedWalletAsset => {
  const normalizedAddress = getAddress(tokenAddress)

  return {
    id: `token:${networkKey}:${normalizedAddress.toLowerCase()}`,
    type: 'token',
    networkKey,
    name,
    symbol,
    decimals,
    coingeckoId,
    tokenAddress: normalizedAddress,
    enabled: true
  }
}

export type DefaultStablecoinAssetDefinition = {
  networkKey: WalletNetworkKey
  name: string
  symbol: string
  tokenAddress: `0x${string}`
  decimals: number
  coingeckoId: string
}

export const defaultStablecoinAssetDefinitions: DefaultStablecoinAssetDefinition[] =
  [
    {
      networkKey: 'mainnet',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'mainnet',
      name: 'Tether USD',
      symbol: 'USDT',
      tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      coingeckoId: 'tether'
    },
    {
      networkKey: 'mainnet',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
      coingeckoId: 'dai'
    },
    {
      networkKey: 'base',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'base',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      tokenAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      decimals: 18,
      coingeckoId: 'dai'
    },
    {
      networkKey: 'arbitrum',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'arbitrum',
      name: 'Tether USD',
      symbol: 'USDT',
      tokenAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
      coingeckoId: 'tether'
    },
    {
      networkKey: 'arbitrum',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      tokenAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
      coingeckoId: 'dai'
    },
    {
      networkKey: 'optimism',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'optimism',
      name: 'Tether USD',
      symbol: 'USDT',
      tokenAddress: '0x94b008aa00579c1307B0EF2c499aD98a8ce58e58',
      decimals: 6,
      coingeckoId: 'tether'
    },
    {
      networkKey: 'optimism',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      tokenAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
      coingeckoId: 'dai'
    },
    {
      networkKey: 'polygon',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'polygon',
      name: 'Tether USD',
      symbol: 'USDT',
      tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      coingeckoId: 'tether'
    },
    {
      networkKey: 'polygon',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      tokenAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      decimals: 18,
      coingeckoId: 'dai'
    },
    {
      networkKey: 'avalanche',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'avalanche',
      name: 'Tether USD',
      symbol: 'USDT',
      tokenAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      decimals: 6,
      coingeckoId: 'tether'
    },
    {
      networkKey: 'linea',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'celo',
      name: 'USD Coin',
      symbol: 'USDC',
      tokenAddress: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
      decimals: 6,
      coingeckoId: 'usd-coin'
    },
    {
      networkKey: 'celo',
      name: 'Tether USD',
      symbol: 'USDT',
      tokenAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
      decimals: 6,
      coingeckoId: 'tether'
    }
  ]

export const getDefaultTrackedStablecoinAssets = (): TrackedWalletAsset[] =>
  defaultStablecoinAssetDefinitions.map(createDefaultStablecoinAsset)

export const mergeTrackedWalletAssets = (
  storedAssets: TrackedWalletAsset[],
  defaultAssets: TrackedWalletAsset[]
): TrackedWalletAsset[] => {
  const storedIds = new Set(storedAssets.map(asset => asset.id))

  return [
    ...storedAssets,
    ...defaultAssets.filter(asset => !storedIds.has(asset.id))
  ]
}

export const getDefaultTrackedStablecoinAssetIds = (): Set<string> =>
  new Set(getDefaultTrackedStablecoinAssets().map(asset => asset.id))

export const getStoredHiddenDefaultTrackedAssetIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()

  const rawValue = window.localStorage.getItem(
    hiddenDefaultTrackedWalletAssetsStorageKey
  )
  if (rawValue == null || rawValue === '') return new Set()

  try {
    const parsed = JSON.parse(rawValue) as unknown
    return Array.isArray(parsed)
      ? new Set(
          parsed.filter((value): value is string => typeof value === 'string')
        )
      : new Set()
  } catch {
    return new Set()
  }
}

export const saveStoredHiddenDefaultTrackedAssetIds = (
  ids: Set<string>
): void => {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    hiddenDefaultTrackedWalletAssetsStorageKey,
    JSON.stringify(Array.from(ids))
  )
}

export const isTrackedWalletAsset = (
  value: unknown
): value is TrackedWalletAsset => {
  if (typeof value !== 'object' || value == null) return false

  const asset = value as Partial<TrackedWalletAsset>
  return (
    typeof asset.id === 'string' &&
    (asset.type === 'native' || asset.type === 'token') &&
    isWalletNetworkKey(asset.networkKey) &&
    typeof asset.name === 'string' &&
    asset.name.trim() !== '' &&
    typeof asset.symbol === 'string' &&
    asset.symbol.trim() !== '' &&
    typeof asset.decimals === 'number' &&
    Number.isInteger(asset.decimals) &&
    asset.decimals >= 0 &&
    asset.decimals <= 36 &&
    typeof asset.coingeckoId === 'string' &&
    typeof asset.enabled === 'boolean' &&
    (asset.type === 'native' ||
      (typeof asset.tokenAddress === 'string' && isAddress(asset.tokenAddress)))
  )
}

export const getStoredTrackedWalletAssets = (): TrackedWalletAsset[] => {
  const hiddenDefaultAssetIds = getStoredHiddenDefaultTrackedAssetIds()
  const defaultAssets = getDefaultTrackedStablecoinAssets().filter(
    asset => !hiddenDefaultAssetIds.has(asset.id)
  )
  if (typeof window === 'undefined') return defaultAssets

  const rawValue = window.localStorage.getItem(trackedWalletAssetsStorageKey)
  if (rawValue == null || rawValue === '') return defaultAssets

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) return defaultAssets

    const storedAssets = parsed
      .filter(isTrackedWalletAsset)
      .filter(asset => asset.type === 'token')
      .map(asset => ({
        ...asset,
        tokenAddress:
          asset.tokenAddress == null
            ? undefined
            : getAddress(asset.tokenAddress)
      }))
    return mergeTrackedWalletAssets(storedAssets, defaultAssets)
  } catch {
    return defaultAssets
  }
}

export const getDefaultTrackedWalletAssets = (): TrackedWalletAsset[] => {
  const hiddenDefaultAssetIds = getStoredHiddenDefaultTrackedAssetIds()
  const defaultAssets = getDefaultTrackedStablecoinAssets().filter(
    asset => !hiddenDefaultAssetIds.has(asset.id)
  )

  return mergeTrackedWalletAssets(getStoredTrackedWalletAssets(), defaultAssets)
}

export const getAddressKey = (address: `0x${string}` | null): string | null =>
  address?.toLowerCase() ?? null

export const getWalletBalanceCacheKey = ({
  addressKey,
  assetId
}: {
  addressKey: string
  assetId: string
}): string => `${addressKey}:${assetId}`

export const readCachedWalletBalances = (): CachedWalletBalances => {
  try {
    const rawValue = window.localStorage.getItem(walletBalancesStorageKey)
    if (rawValue == null) return {}

    const parsed = JSON.parse(rawValue) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, cachedBalance]) => {
        if (
          cachedBalance == null ||
          typeof cachedBalance !== 'object' ||
          Array.isArray(cachedBalance)
        ) {
          return []
        }

        const value = (cachedBalance as Partial<CachedWalletBalance>).value
        const fetchedAt = (cachedBalance as Partial<CachedWalletBalance>)
          .fetchedAt
        return typeof value === 'string' &&
          /^-?\d+$/.test(value) &&
          typeof fetchedAt === 'number' &&
          Number.isFinite(fetchedAt)
          ? [[key, { value, fetchedAt }]]
          : []
      })
    )
  } catch {
    return {}
  }
}

export const saveCachedWalletBalances = (
  cache: CachedWalletBalances
): void => {
  window.localStorage.setItem(walletBalancesStorageKey, JSON.stringify(cache))
}

export const getCachedWalletBalanceValue = ({
  cache,
  addressKey,
  assetId,
  maxAgeMs
}: {
  cache: CachedWalletBalances
  addressKey: string
  assetId: string
  maxAgeMs: number
}): bigint | null => {
  const cachedBalance = cache[getWalletBalanceCacheKey({ addressKey, assetId })]
  if (cachedBalance == null) return null
  if (Date.now() - cachedBalance.fetchedAt > maxAgeMs) return null

  return BigInt(cachedBalance.value)
}

export const getIncludedCustomWalletAssets = ({
  trackedWalletAssets,
  selectedWalletNetworkKeys
}: {
  trackedWalletAssets: TrackedWalletAsset[]
  selectedWalletNetworkKeys: WalletNetworkKey[]
}): TrackedWalletAsset[] =>
  trackedWalletAssets.filter(
    asset => asset.enabled && selectedWalletNetworkKeys.includes(asset.networkKey)
  )

export const getIncludedTrackedWalletAssets = ({
  selectedNativeAssets,
  trackedWalletAssets,
  selectedWalletNetworkKeys
}: {
  selectedNativeAssets: TrackedWalletAsset[]
  trackedWalletAssets: TrackedWalletAsset[]
  selectedWalletNetworkKeys: WalletNetworkKey[]
}): TrackedWalletAsset[] => [
  ...selectedNativeAssets,
  ...getIncludedCustomWalletAssets({
    trackedWalletAssets,
    selectedWalletNetworkKeys
  })
]

export const groupTrackedWalletAssets = (
  trackedWalletAssets: TrackedWalletAsset[]
): TrackedWalletAssetGroup[] => {
  const groups = new Map<string, TrackedWalletAssetGroup>()

  trackedWalletAssets.forEach(asset => {
    const key = `${asset.symbol.toLowerCase()}:${asset.coingeckoId.toLowerCase()}`
    const existingGroup = groups.get(key)
    if (existingGroup == null) {
      groups.set(key, {
        key,
        symbol: asset.symbol,
        name: asset.name,
        assets: [asset]
      })
      return
    }

    existingGroup.assets.push(asset)
  })

  return Array.from(groups.values()).sort((left, right) =>
    left.symbol.localeCompare(right.symbol)
  )
}

export const calculatePortfolioValue = ({
  assets,
  balances,
  prices,
  usdConversionRate
}: {
  assets: TrackedWalletAsset[]
  balances: Record<string, bigint | null>
  prices: Record<string, number | null>
  usdConversionRate: number
}): number => {
  let total = 0

  assets.forEach(asset => {
    const balance = balances[asset.id]
    const price =
      asset.coingeckoId.trim() === '' ? null : prices[asset.coingeckoId.trim()]
    if (balance == null || price == null) return

    total += Number(formatUnits(balance, asset.decimals)) * price
  })

  return total * usdConversionRate
}

export type DiscoverFundedWalletAssetsInput = {
  activeAccountAddress: `0x${string}`
  availableWalletNetworkOptions: WalletNetworkOption[]
  selectedWalletNetworkKeys: WalletNetworkKey[]
  trackedWalletAssets: TrackedWalletAsset[]
  walletNetworkKey: WalletNetworkKey
}

export type DiscoverFundedWalletAssetsResult = {
  assetBalances: Record<string, bigint | null>
  selectedWalletNetworkKeys: WalletNetworkKey[]
  trackedWalletAssets: TrackedWalletAsset[]
  walletNetworkKey: WalletNetworkKey
}

export const discoverFundedWalletAssets = async ({
  activeAccountAddress,
  availableWalletNetworkOptions,
  selectedWalletNetworkKeys,
  trackedWalletAssets,
  walletNetworkKey
}: DiscoverFundedWalletAssetsInput): Promise<DiscoverFundedWalletAssetsResult> => {
  const defaultAssetIds = getDefaultTrackedStablecoinAssetIds()
  const fundedNetworkKeys = new Set<WalletNetworkKey>()
  const fundedAssetIds = new Set<string>()
  const balanceEntries: [string, bigint | null][] = []
  const addressKey = activeAccountAddress.toLowerCase()
  const cachedBalances = readCachedWalletBalances()
  const now = Date.now()

  for (const option of availableWalletNetworkOptions) {
    const networkAssets = trackedWalletAssets.filter(
      asset => asset.type === 'token' && asset.networkKey === option.key
    )
    const nativeAssetId = `native:${option.key}`
    const cachedNativeBalance = getCachedWalletBalanceValue({
      cache: cachedBalances,
      addressKey,
      assetId: nativeAssetId,
      maxAgeMs: walletBalanceCacheTtlMs
    })

    if (cachedNativeBalance != null) {
      balanceEntries.push([nativeAssetId, cachedNativeBalance])
      if (cachedNativeBalance > 0n) fundedNetworkKeys.add(option.key)
    } else {
      try {
        const client = createWalletPublicClient(option)
        const nativeBalance = await client.getBalance({
          address: activeAccountAddress
        })
        balanceEntries.push([nativeAssetId, nativeBalance])
        cachedBalances[
          getWalletBalanceCacheKey({
            addressKey,
            assetId: nativeAssetId
          })
        ] = { value: nativeBalance.toString(), fetchedAt: now }
        if (nativeBalance > 0n) fundedNetworkKeys.add(option.key)
      } catch (networkDiscoveryError) {
        console.warn(
          `Unable to discover native balance on ${option.label}:`,
          networkDiscoveryError
        )
        const fallbackBalance = getCachedWalletBalanceValue({
          cache: cachedBalances,
          addressKey,
          assetId: nativeAssetId,
          maxAgeMs: walletBalanceStaleFallbackTtlMs
        })
        balanceEntries.push([nativeAssetId, fallbackBalance])
        if (fallbackBalance != null && fallbackBalance > 0n) {
          fundedNetworkKeys.add(option.key)
        }
      }
    }

    const client = createWalletPublicClient(option)
    for (const asset of networkAssets) {
      const cachedTokenBalance = getCachedWalletBalanceValue({
        cache: cachedBalances,
        addressKey,
        assetId: asset.id,
        maxAgeMs: walletBalanceCacheTtlMs
      })

      if (cachedTokenBalance != null) {
        balanceEntries.push([asset.id, cachedTokenBalance])
        if (cachedTokenBalance > 0n) {
          fundedNetworkKeys.add(option.key)
          fundedAssetIds.add(asset.id)
        }
        continue
      }

      try {
        const balance = await client.readContract({
          address: asset.tokenAddress!,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [activeAccountAddress]
        })
        balanceEntries.push([asset.id, balance])
        cachedBalances[
          getWalletBalanceCacheKey({
            addressKey,
            assetId: asset.id
          })
        ] = { value: balance.toString(), fetchedAt: now }
        if (balance > 0n) {
          fundedNetworkKeys.add(option.key)
          fundedAssetIds.add(asset.id)
        }
      } catch (assetDiscoveryError) {
        console.warn(
          `Unable to discover ${asset.symbol} on ${option.label}:`,
          assetDiscoveryError
        )
        const fallbackBalance = getCachedWalletBalanceValue({
          cache: cachedBalances,
          addressKey,
          assetId: asset.id,
          maxAgeMs: walletBalanceStaleFallbackTtlMs
        })
        balanceEntries.push([asset.id, fallbackBalance])
        if (fallbackBalance != null && fallbackBalance > 0n) {
          fundedNetworkKeys.add(option.key)
          fundedAssetIds.add(asset.id)
        }
      }
    }
  }

  const explicitlyTrackedNetworkKeys = trackedWalletAssets
    .filter(asset => !defaultAssetIds.has(asset.id) && asset.enabled)
    .map(asset => asset.networkKey)
  const discoveredNetworkKeys = availableWalletNetworkOptions
    .map(option => option.key)
    .filter(
      key =>
        fundedNetworkKeys.has(key) ||
        explicitlyTrackedNetworkKeys.includes(key)
    )
  const nextNetworkKeys =
    discoveredNetworkKeys.length === 0
      ? selectedWalletNetworkKeys
      : Array.from(
          new Set([...selectedWalletNetworkKeys, ...discoveredNetworkKeys])
        )
  const nextWalletNetworkKey =
    nextNetworkKeys.includes(walletNetworkKey) || nextNetworkKeys[0] == null
      ? walletNetworkKey
      : nextNetworkKeys[0]
  const nextTrackedWalletAssets = trackedWalletAssets.map(asset =>
    defaultAssetIds.has(asset.id)
      ? { ...asset, enabled: fundedAssetIds.has(asset.id) }
      : {
          ...asset,
          enabled: asset.enabled || fundedAssetIds.has(asset.id)
        }
  )

  saveCachedWalletBalances(cachedBalances)

  return {
    assetBalances: Object.fromEntries(balanceEntries),
    selectedWalletNetworkKeys: nextNetworkKeys,
    trackedWalletAssets: nextTrackedWalletAssets,
    walletNetworkKey: nextWalletNetworkKey
  }
}

export const createTrackedTokenAsset = ({
  networkKey,
  name,
  symbol,
  address,
  decimals: decimalsInput,
  coingeckoId: coingeckoIdInput
}: AddTrackedTokenAssetInput):
  | { ok: true; asset: TrackedWalletAsset }
  | { ok: false; error: string } => {
  const tokenAddress = address.trim()
  const coingeckoId = coingeckoIdInput.trim()
  const decimals = Number(decimalsInput)
  if (!isAddress(tokenAddress)) {
    return { ok: false, error: 'Enter a valid token contract address.' }
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return { ok: false, error: 'Enter token decimals between 0 and 36.' }
  }
  if (symbol.trim() === '' || name.trim() === '') {
    return { ok: false, error: 'Enter the token name and symbol.' }
  }
  if (coingeckoId === '') {
    return {
      ok: false,
      error: 'Enter the CoinGecko token id used for pricing.'
    }
  }

  const normalizedAddress = getAddress(tokenAddress as `0x${string}`)
  return {
    ok: true,
    asset: {
      id: `token:${networkKey}:${normalizedAddress.toLowerCase()}`,
      type: 'token',
      networkKey,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      decimals,
      coingeckoId,
      tokenAddress: normalizedAddress,
      enabled: true
    }
  }
}

export const createCustomWalletNetwork = ({
  name,
  chainId: chainIdInput,
  rpcUrl: rpcUrlInput,
  currencyName,
  currencySymbol,
  currencyDecimals,
  coingeckoId
}: AddCustomWalletNetworkInput):
  | { ok: true; network: CustomWalletNetwork }
  | { ok: false; error: string } => {
  const label = name.trim()
  const chainId = Number(chainIdInput)
  const rpcUrl = rpcUrlInput.trim()
  const nativeCurrencyName = currencyName.trim()
  const nativeCurrencySymbol = currencySymbol.trim().toUpperCase()
  const nativeCurrencyDecimals = Number(currencyDecimals)
  const priceId = coingeckoId.trim()

  if (label === '') {
    return { ok: false, error: 'Enter a network name.' }
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return { ok: false, error: 'Enter a valid chain id.' }
  }
  try {
    const parsedRpcUrl = new URL(rpcUrl)
    if (
      parsedRpcUrl.protocol !== 'http:' &&
      parsedRpcUrl.protocol !== 'https:'
    ) {
      throw new Error('Invalid RPC protocol.')
    }
  } catch {
    return { ok: false, error: 'Enter a valid HTTP RPC URL.' }
  }
  if (nativeCurrencyName === '' || nativeCurrencySymbol === '') {
    return {
      ok: false,
      error: 'Enter the native currency name and symbol.'
    }
  }
  if (
    !Number.isInteger(nativeCurrencyDecimals) ||
    nativeCurrencyDecimals < 0 ||
    nativeCurrencyDecimals > 36
  ) {
    return {
      ok: false,
      error: 'Enter native currency decimals between 0 and 36.'
    }
  }

  return {
    ok: true,
    network: {
      key: `custom:${chainId}`,
      label,
      chainId,
      rpcUrl,
      nativeCurrencyName,
      nativeCurrencySymbol,
      nativeCurrencyDecimals,
      ...(priceId !== '' ? { priceId } : {})
    }
  }
}

export const getStoredPortfolioCurrency = (): PortfolioCurrency => {
  if (typeof window === 'undefined') return 'EUR'

  const storedCurrency = window.localStorage.getItem(
    portfolioCurrencyStorageKey
  )
  return portfolioCurrencies.includes(storedCurrency as PortfolioCurrency)
    ? (storedCurrency as PortfolioCurrency)
    : 'EUR'
}

export type NativeAssetPrice = {
  usd?: number
}

export type AssetPricesResponse = {
  [priceId: string]: NativeAssetPrice | undefined
}

export type CachedAssetUsdPrice = {
  price: number
  fetchedAt: number
}

export type CachedAssetUsdPrices = Record<string, CachedAssetUsdPrice>

export type AssetMarketChartResponse = {
  prices?: [number, number][]
}

export type ExchangeRateResponse = {
  rate?: number
}

export type CachedUsdConversionRate = {
  rate: number
  fetchedAt: number
}

export type CachedUsdConversionRates = Record<string, CachedUsdConversionRate>

export const assetUsdPricesStorageKey =
  'organigram.passkeyWallet.assetUsdPrices'
export const usdConversionRatesStorageKey =
  'organigram.passkeyWallet.usdConversionRates'
export const assetUsdPriceCacheTtlMs = 15 * 60 * 1000
export const assetUsdPriceStaleFallbackTtlMs = 24 * 60 * 60 * 1000
export const usdConversionRateCacheTtlMs = 60 * 60 * 1000
export const usdConversionRateStaleFallbackTtlMs = 24 * 60 * 60 * 1000

export const formatCurrencyAmount = (
  value: number,
  currency: PortfolioCurrency
): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0)

const readCachedAssetUsdPrices = (): CachedAssetUsdPrices => {
  try {
    const rawValue = window.localStorage.getItem(assetUsdPricesStorageKey)
    if (rawValue == null) return {}

    const parsed = JSON.parse(rawValue) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([priceId, cachedPrice]) => {
        if (
          cachedPrice == null ||
          typeof cachedPrice !== 'object' ||
          Array.isArray(cachedPrice)
        ) {
          return []
        }

        const price = (cachedPrice as Partial<CachedAssetUsdPrice>).price
        const fetchedAt = (cachedPrice as Partial<CachedAssetUsdPrice>).fetchedAt
        return typeof price === 'number' &&
          Number.isFinite(price) &&
          typeof fetchedAt === 'number' &&
          Number.isFinite(fetchedAt)
          ? [[priceId, { price, fetchedAt }]]
          : []
      })
    )
  } catch {
    return {}
  }
}

const saveCachedAssetUsdPrices = (cache: CachedAssetUsdPrices): void => {
  window.localStorage.setItem(assetUsdPricesStorageKey, JSON.stringify(cache))
}

const readCachedUsdConversionRates = (): CachedUsdConversionRates => {
  try {
    const rawValue = window.localStorage.getItem(usdConversionRatesStorageKey)
    if (rawValue == null) return {}

    const parsed = JSON.parse(rawValue) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([currency, cachedRate]) => {
        if (
          cachedRate == null ||
          typeof cachedRate !== 'object' ||
          Array.isArray(cachedRate)
        ) {
          return []
        }

        const rate = (cachedRate as Partial<CachedUsdConversionRate>).rate
        const fetchedAt = (cachedRate as Partial<CachedUsdConversionRate>)
          .fetchedAt
        return typeof rate === 'number' &&
          Number.isFinite(rate) &&
          typeof fetchedAt === 'number' &&
          Number.isFinite(fetchedAt)
          ? [[currency, { rate, fetchedAt }]]
          : []
      })
    )
  } catch {
    return {}
  }
}

const saveCachedUsdConversionRates = (
  cache: CachedUsdConversionRates
): void => {
  window.localStorage.setItem(usdConversionRatesStorageKey, JSON.stringify(cache))
}

export const fetchAssetUsdPrices = async (
  priceIds: string[]
): Promise<Record<string, number | null>> => {
  const uniquePriceIds = Array.from(new Set(priceIds))
  if (uniquePriceIds.length === 0) return {}

  const now = Date.now()
  const cachedPrices = readCachedAssetUsdPrices()
  const prices = Object.fromEntries(
    uniquePriceIds.map(priceId => {
      const cachedPrice = cachedPrices[priceId]
      const isFresh =
        cachedPrice != null &&
        now - cachedPrice.fetchedAt <= assetUsdPriceCacheTtlMs
      return [priceId, isFresh ? cachedPrice.price : null]
    })
  ) as Record<string, number | null>
  const missingPriceIds = uniquePriceIds.filter(
    priceId => prices[priceId] == null
  )
  if (missingPriceIds.length === 0) return prices

  const url = new URL('https://api.coingecko.com/api/v3/simple/price')
  url.searchParams.set('ids', missingPriceIds.join(','))
  url.searchParams.set('vs_currencies', 'usd')

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Price request failed with status ${response.status}.`)
    }

    const body = (await response.json()) as AssetPricesResponse
    missingPriceIds.forEach(priceId => {
      const price = body[priceId]?.usd
      if (typeof price !== 'number' || !Number.isFinite(price)) return

      prices[priceId] = price
      cachedPrices[priceId] = { price, fetchedAt: now }
    })
    saveCachedAssetUsdPrices(cachedPrices)
  } catch (priceError) {
    console.warn('Unable to load asset prices:', priceError)

    missingPriceIds.forEach(priceId => {
      const cachedPrice = cachedPrices[priceId]
      const isUsableFallback =
        cachedPrice != null &&
        now - cachedPrice.fetchedAt <= assetUsdPriceStaleFallbackTtlMs
      if (isUsableFallback) prices[priceId] = cachedPrice.price
    })
  }

  return prices
}

export const fetchUsdConversionRate = async (
  currency: PortfolioCurrency
): Promise<number> => {
  if (currency === 'USD') return 1

  const now = Date.now()
  const cachedRates = readCachedUsdConversionRates()
  const cachedRate = cachedRates[currency]
  if (
    cachedRate != null &&
    now - cachedRate.fetchedAt <= usdConversionRateCacheTtlMs
  ) {
    return cachedRate.rate
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/USD/${currency}`
    )
    if (!response.ok) {
      throw new Error(
        `Currency conversion failed with status ${response.status}.`
      )
    }

    const body = (await response.json()) as ExchangeRateResponse
    const rate = typeof body.rate === 'number' ? body.rate : 1
    cachedRates[currency] = { rate, fetchedAt: now }
    saveCachedUsdConversionRates(cachedRates)
    return rate
  } catch (conversionError) {
    console.warn('Unable to load currency conversion rate:', conversionError)

    const isUsableFallback =
      cachedRate != null &&
      now - cachedRate.fetchedAt <= usdConversionRateStaleFallbackTtlMs
    if (isUsableFallback) return cachedRate.rate

    return 1
  }
}

export const fetchAssetUsdHistory = async ({
  priceId,
  period
}: {
  priceId: string
  period: PortfolioPeriod
}): Promise<[number, number][]> => {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      priceId
    )}/market_chart?vs_currency=usd&days=${period}`
  )
  if (!response.ok) {
    throw new Error(
      `Historical price request failed with status ${response.status}.`
    )
  }

  const body = (await response.json()) as AssetMarketChartResponse
  return Array.isArray(body.prices) ? body.prices : []
}

export const formatAssetBalance = (value: bigint, decimals: number): string => {
  const [whole, fraction = ''] = formatUnits(value, decimals).split('.')
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, '')

  return trimmedFraction === '' ? whole : `${whole}.${trimmedFraction}`
}

export const normalizeTransactionData = (value: string): Hex | undefined => {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  if (!/^0x(?:[a-fA-F0-9]{2})*$/.test(trimmed)) {
    throw new Error('Transaction data must be hex bytes.')
  }

  return trimmed as Hex
}

export const gasPriorityFees: Record<GasPriority, bigint> = {
  slow: parseGwei('1'),
  normal: parseGwei('1.5'),
  fast: parseGwei('3')
}
