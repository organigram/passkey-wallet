import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { erc20Abi, formatUnits, type Hex } from 'viem'

import {
  calculatePortfolioValue,
  builtinWalletNetworkOptions,
  createCustomWalletNetwork,
  createCustomWalletNetworkOption,
  createTrackedTokenAsset,
  createWalletPublicClient,
  discoverFundedWalletAssets as discoverFundedWalletAssetsFromNetworks,
  fetchAssetUsdHistory,
  fetchAssetUsdPrices,
  fetchUsdConversionRate,
  formatCurrencyAmount,
  getDefaultTrackedStablecoinAssetIds,
  getDefaultTrackedWalletAssets,
  getDefaultWalletNetworkKey,
  getAddressKey,
  getCachedWalletBalanceValue,
  getIncludedCustomWalletAssets,
  getIncludedTrackedWalletAssets,
  getNativeWalletAssets,
  getWalletBalanceCacheKey,
  getStoredCustomWalletNetworks,
  getStoredHiddenDefaultTrackedAssetIds,
  getStoredPortfolioCurrency,
  getStoredShowTestWalletNetworks,
  getStoredWalletBalanceNetworkKeys,
  getStoredWalletNetworkKey,
  getWalletNetworkOptionFrom,
  groupTrackedWalletAssets,
  portfolioCurrencyStorageKey,
  readCachedWalletBalances,
  saveCachedWalletBalances,
  saveStoredHiddenDefaultTrackedAssetIds,
  showTestWalletNetworksStorageKey,
  trackedWalletAssetsStorageKey,
  customWalletNetworksStorageKey,
  walletBalanceCacheTtlMs,
  walletBalanceNetworksStorageKey,
  walletBalanceStaleFallbackTtlMs,
  walletNetworkStorageKey,
  type AddCustomWalletNetworkInput,
  type AddTrackedTokenAssetInput,
  type CustomWalletNetwork,
  type PortfolioCurrency,
  type PortfolioPeriod,
  type TrackedWalletAsset,
  type WalletNetworkKey
} from '../helpers/wallet'

type AddressPortfolioState = {
  trackedWalletAssets: TrackedWalletAsset[]
  assetBalances: Record<string, bigint | null>
  walletNetworkKey: WalletNetworkKey
  selectedWalletNetworkKeys: WalletNetworkKey[]
  lastTransactionHash: Hex | null
  balanceRefreshKey: number
}

export const useWalletPortfolio = ({
  activeAccountAddress,
  setError
}: {
  activeAccountAddress: `0x${string}` | null
  setError: (error: string | null) => void
}) => {
  const [trackedWalletAssets, setTrackedWalletAssets] = useState<
    TrackedWalletAsset[]
  >(getDefaultTrackedWalletAssets)
  const [assetBalances, setAssetBalances] = useState<
    Record<string, bigint | null>
  >({})
  const [assetUsdPrices, setAssetUsdPrices] = useState<
    Record<string, number | null>
  >({})
  const [usdConversionRate, setUsdConversionRate] = useState(1)
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [isPriceLoading, setIsPriceLoading] = useState(false)
  const [isPortfolioHistoryLoading, setIsPortfolioHistoryLoading] =
    useState(false)
  const [isDiscoveringAssets, setIsDiscoveringAssets] = useState(false)
  const [portfolioHistory, setPortfolioHistory] = useState<
    { timestamp: number; value: number }[]
  >([])
  const [portfolioCurrency, setPortfolioCurrency] = useState<PortfolioCurrency>(
    getStoredPortfolioCurrency
  )
  const [portfolioPeriod, setPortfolioPeriod] = useState<PortfolioPeriod>('30')
  const [customWalletNetworks, setCustomWalletNetworks] = useState<
    CustomWalletNetwork[]
  >(getStoredCustomWalletNetworks)
  const [showTestWalletNetworks, setShowTestWalletNetworks] = useState(
    getStoredShowTestWalletNetworks
  )
  const [walletNetworkKey, setWalletNetworkKey] = useState<WalletNetworkKey>(
    getStoredWalletNetworkKey
  )
  const [selectedWalletNetworkKeys, setSelectedWalletNetworkKeys] = useState<
    WalletNetworkKey[]
  >(getStoredWalletBalanceNetworkKeys)
  const [lastTransactionHash, setLastTransactionHash] = useState<Hex | null>(
    null
  )
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0)
  const [portfolioStateAddressKey, setPortfolioStateAddressKey] = useState<
    string | null
  >(() => getAddressKey(activeAccountAddress))
  const addressPortfolioStatesRef = useRef<Record<string, AddressPortfolioState>>(
    {}
  )
  const restoredCachedAddressKeyRef = useRef<string | null>(null)

  const allWalletNetworkOptions = useMemo(
    () => [
      ...builtinWalletNetworkOptions,
      ...customWalletNetworks.map(createCustomWalletNetworkOption)
    ],
    [customWalletNetworks]
  )
  const availableWalletNetworkOptions = useMemo(
    () =>
      allWalletNetworkOptions.filter(
        option => showTestWalletNetworks || option.testnet !== true
      ),
    [allWalletNetworkOptions, showTestWalletNetworks]
  )
  const walletNetwork = useMemo(
    () =>
      getWalletNetworkOptionFrom(allWalletNetworkOptions, walletNetworkKey),
    [allWalletNetworkOptions, walletNetworkKey]
  )
  const selectedWalletNetworks = useMemo(
    () =>
      selectedWalletNetworkKeys.map(key =>
        getWalletNetworkOptionFrom(allWalletNetworkOptions, key)
      ),
    [allWalletNetworkOptions, selectedWalletNetworkKeys]
  )
  const selectedNativeAssets = useMemo(
    () => getNativeWalletAssets(selectedWalletNetworks),
    [selectedWalletNetworks]
  )
  const includedTrackedAssets = useMemo(
    () =>
      getIncludedTrackedWalletAssets({
        selectedNativeAssets,
        trackedWalletAssets,
        selectedWalletNetworkKeys
      }),
    [selectedNativeAssets, selectedWalletNetworkKeys, trackedWalletAssets]
  )
  const includedCustomAssets = useMemo(
    () =>
      getIncludedCustomWalletAssets({
        trackedWalletAssets,
        selectedWalletNetworkKeys
      }),
    [selectedWalletNetworkKeys, trackedWalletAssets]
  )
  const trackedWalletAssetGroups = useMemo(
    () => groupTrackedWalletAssets(trackedWalletAssets),
    [trackedWalletAssets]
  )
  const walletChain = walletNetwork.chain
  const walletRpcUrl = walletNetwork.rpcUrl
  const nativeAssetSymbol = walletChain.nativeCurrency.symbol
  const selectedPortfolioValue = useMemo(
    () =>
      calculatePortfolioValue({
        assets: includedTrackedAssets,
        balances: assetBalances,
        prices: assetUsdPrices,
        usdConversionRate
      }),
    [assetBalances, assetUsdPrices, includedTrackedAssets, usdConversionRate]
  )
  const selectedPortfolioValueText = useMemo(() => {
    if (selectedPortfolioValue === 0 && (isBalanceLoading || isPriceLoading)) {
      return '-'
    }

    return formatCurrencyAmount(selectedPortfolioValue, portfolioCurrency)
  }, [
    isBalanceLoading,
    isPriceLoading,
    portfolioCurrency,
    selectedPortfolioValue
  ])
  const currentAddressPortfolioState = useMemo<AddressPortfolioState>(
    () => ({
      trackedWalletAssets,
      assetBalances,
      walletNetworkKey,
      selectedWalletNetworkKeys,
      lastTransactionHash,
      balanceRefreshKey
    }),
    [
      assetBalances,
      balanceRefreshKey,
      lastTransactionHash,
      selectedWalletNetworkKeys,
      trackedWalletAssets,
      walletNetworkKey
    ]
  )

  useEffect(() => {
    if (portfolioStateAddressKey == null) return

    addressPortfolioStatesRef.current[portfolioStateAddressKey] =
      currentAddressPortfolioState
  }, [currentAddressPortfolioState, portfolioStateAddressKey])

  useEffect(() => {
    const nextAddressKey = getAddressKey(activeAccountAddress)
    if (nextAddressKey === portfolioStateAddressKey) return

    if (portfolioStateAddressKey != null) {
      addressPortfolioStatesRef.current[portfolioStateAddressKey] =
        currentAddressPortfolioState
    }

    const cachedState =
      nextAddressKey == null
        ? null
        : addressPortfolioStatesRef.current[nextAddressKey]

    if (cachedState == null) {
      setTrackedWalletAssets(getDefaultTrackedWalletAssets())
      setAssetBalances({})
      setWalletNetworkKey(getStoredWalletNetworkKey())
      setSelectedWalletNetworkKeys(getStoredWalletBalanceNetworkKeys())
      setLastTransactionHash(null)
      setBalanceRefreshKey(value => value + 1)
      restoredCachedAddressKeyRef.current = null
    } else {
      setTrackedWalletAssets(cachedState.trackedWalletAssets)
      setAssetBalances(cachedState.assetBalances)
      setWalletNetworkKey(cachedState.walletNetworkKey)
      setSelectedWalletNetworkKeys(cachedState.selectedWalletNetworkKeys)
      setLastTransactionHash(cachedState.lastTransactionHash)
      setBalanceRefreshKey(cachedState.balanceRefreshKey)
      restoredCachedAddressKeyRef.current = nextAddressKey
    }

    setPortfolioHistory([])
    setIsBalanceLoading(false)
    setIsDiscoveringAssets(false)
    setPortfolioStateAddressKey(nextAddressKey)
  }, [activeAccountAddress])

  const toggleWalletBalanceNetwork = useCallback(
    (key: WalletNetworkKey): void => {
      setSelectedWalletNetworkKeys(currentKeys => {
        if (currentKeys.includes(key)) {
          const nextKeys = currentKeys.filter(currentKey => currentKey !== key)
          if (walletNetworkKey === key && nextKeys[0] != null) {
            setWalletNetworkKey(nextKeys[0])
          }
          return nextKeys
        }

        setWalletNetworkKey(key)
        return [...currentKeys, key]
      })
    },
    [walletNetworkKey]
  )
  const setVisibleWalletBalanceNetworks = useCallback(
    (shouldSelect: boolean): void => {
      const visibleKeys = new Set(
        availableWalletNetworkOptions.map(option => option.key)
      )
      setSelectedWalletNetworkKeys(currentKeys => {
        const hiddenSelectedKeys = currentKeys.filter(
          currentKey => !visibleKeys.has(currentKey)
        )
        const nextKeys = shouldSelect
          ? [...hiddenSelectedKeys, ...Array.from(visibleKeys)]
          : hiddenSelectedKeys

        if (!nextKeys.includes(walletNetworkKey) && nextKeys[0] != null) {
          setWalletNetworkKey(nextKeys[0])
        }

        return nextKeys
      })
    },
    [availableWalletNetworkOptions, walletNetworkKey]
  )
  const toggleTrackedWalletAsset = useCallback((assetId: string): void => {
    setTrackedWalletAssets(currentAssets =>
      currentAssets.map(asset =>
        asset.id === assetId ? { ...asset, enabled: !asset.enabled } : asset
      )
    )
  }, [])
  const toggleTrackedWalletAssetGroup = useCallback(
    (assetIds: string[]): void => {
      setTrackedWalletAssets(currentAssets => {
        const assetIdSet = new Set(assetIds)
        const shouldEnable = currentAssets.some(
          asset => assetIdSet.has(asset.id) && !asset.enabled
        )

        return currentAssets.map(asset =>
          assetIdSet.has(asset.id) ? { ...asset, enabled: shouldEnable } : asset
        )
      })
    },
    []
  )

  const addTrackedTokenAsset = (input: AddTrackedTokenAssetInput): boolean => {
    const result = createTrackedTokenAsset(input)
    if (!result.ok) {
      setError(result.error)
      return false
    }

    setTrackedWalletAssets(currentAssets => [
      ...currentAssets.filter(currentAsset => currentAsset.id !== result.asset.id),
      result.asset
    ])
    const hiddenDefaultAssetIds = getStoredHiddenDefaultTrackedAssetIds()
    if (hiddenDefaultAssetIds.delete(result.asset.id)) {
      saveStoredHiddenDefaultTrackedAssetIds(hiddenDefaultAssetIds)
    }
    if (!selectedWalletNetworkKeys.includes(result.asset.networkKey)) {
      setSelectedWalletNetworkKeys(currentKeys => [
        ...currentKeys,
        result.asset.networkKey
      ])
    }
    setWalletNetworkKey(result.asset.networkKey)
    setError(null)
    setBalanceRefreshKey(value => value + 1)
    return true
  }

  const removeTrackedTokenAsset = (assetId: string): void => {
    const defaultAssetIds = getDefaultTrackedStablecoinAssetIds()
    if (defaultAssetIds.has(assetId)) {
      const hiddenDefaultAssetIds = getStoredHiddenDefaultTrackedAssetIds()
      hiddenDefaultAssetIds.add(assetId)
      saveStoredHiddenDefaultTrackedAssetIds(hiddenDefaultAssetIds)
    }
    setTrackedWalletAssets(currentAssets =>
      currentAssets.filter(asset => asset.id !== assetId)
    )
  }

  const addCustomWalletNetwork = (
    input: AddCustomWalletNetworkInput
  ): boolean => {
    const result = createCustomWalletNetwork(input)
    if (!result.ok) {
      setError(result.error)
      return false
    }

    setCustomWalletNetworks(currentNetworks => [
      ...currentNetworks.filter(
        currentNetwork => currentNetwork.key !== result.network.key
      ),
      result.network
    ])
    setSelectedWalletNetworkKeys(currentKeys =>
      currentKeys.includes(result.network.key)
        ? currentKeys
        : [...currentKeys, result.network.key]
    )
    setWalletNetworkKey(result.network.key)
    setError(null)
    return true
  }

  const removeCustomWalletNetwork = (key: WalletNetworkKey): void => {
    setCustomWalletNetworks(currentNetworks =>
      currentNetworks.filter(network => network.key !== key)
    )
    setSelectedWalletNetworkKeys(currentKeys =>
      currentKeys.filter(currentKey => currentKey !== key)
    )
    setTrackedWalletAssets(currentAssets =>
      currentAssets.filter(asset => asset.networkKey !== key)
    )
    if (walletNetworkKey === key) {
      setWalletNetworkKey(getDefaultWalletNetworkKey())
    }
  }

  const discoverFundedWalletAssets = async (): Promise<void> => {
    if (activeAccountAddress == null) {
      setError('Select an account before discovering assets.')
      return
    }

    setIsDiscoveringAssets(true)
    setError(null)

    try {
      const discovery = await discoverFundedWalletAssetsFromNetworks({
        activeAccountAddress,
        availableWalletNetworkOptions,
        selectedWalletNetworkKeys,
        trackedWalletAssets,
        walletNetworkKey
      })
      setSelectedWalletNetworkKeys(discovery.selectedWalletNetworkKeys)
      setWalletNetworkKey(discovery.walletNetworkKey)
      setTrackedWalletAssets(discovery.trackedWalletAssets)
      setAssetBalances(discovery.assetBalances)
      setBalanceRefreshKey(value => value + 1)
    } finally {
      setIsDiscoveringAssets(false)
    }
  }

  const syncWalletBalances = (): void => {
    setBalanceRefreshKey(value => value + 1)
  }

  useEffect(() => {
    window.localStorage.setItem(walletNetworkStorageKey, walletNetworkKey)
    setLastTransactionHash(null)
  }, [walletNetworkKey])

  useEffect(() => {
    window.localStorage.setItem(
      trackedWalletAssetsStorageKey,
      JSON.stringify(trackedWalletAssets)
    )
  }, [trackedWalletAssets])

  useEffect(() => {
    window.localStorage.setItem(
      customWalletNetworksStorageKey,
      JSON.stringify(customWalletNetworks)
    )
  }, [customWalletNetworks])

  useEffect(() => {
    window.localStorage.setItem(
      showTestWalletNetworksStorageKey,
      String(showTestWalletNetworks)
    )
  }, [showTestWalletNetworks])

  useEffect(() => {
    window.localStorage.setItem(portfolioCurrencyStorageKey, portfolioCurrency)
  }, [portfolioCurrency])

  useEffect(() => {
    window.localStorage.setItem(
      walletBalanceNetworksStorageKey,
      JSON.stringify(selectedWalletNetworkKeys)
    )
    if (restoredCachedAddressKeyRef.current !== portfolioStateAddressKey) {
      setBalanceRefreshKey(value => value + 1)
    }
  }, [portfolioStateAddressKey, selectedWalletNetworkKeys])

  useEffect(() => {
    const priceIds = includedTrackedAssets
      .map(asset => asset.coingeckoId.trim())
      .filter(Boolean)

    if (priceIds.length === 0) {
      setAssetUsdPrices({})
      setIsPriceLoading(false)
      return
    }

    let cancelled = false
    setIsPriceLoading(true)
    Promise.all([
      fetchAssetUsdPrices(priceIds),
      fetchUsdConversionRate(portfolioCurrency)
    ])
      .then(([prices, conversionRate]) => {
        if (cancelled) return

        setAssetUsdPrices(prices)
        setUsdConversionRate(conversionRate)
      })
      .catch(priceError => {
        console.warn('Unable to load asset prices:', priceError)
        if (!cancelled) {
          setAssetUsdPrices(
            Object.fromEntries(
              Array.from(new Set(priceIds)).map(priceId => [priceId, null])
            )
          )
          setUsdConversionRate(portfolioCurrency === 'USD' ? 1 : 0)
        }
      })
      .finally(() => {
        if (!cancelled) setIsPriceLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [balanceRefreshKey, includedTrackedAssets, portfolioCurrency])

  useEffect(() => {
    const activeAddressKey = getAddressKey(activeAccountAddress)
    if (
      activeAccountAddress == null ||
      activeAddressKey == null ||
      activeAddressKey !== portfolioStateAddressKey
    ) {
      setIsBalanceLoading(false)
      return
    }

    if (includedTrackedAssets.length === 0) {
      setAssetBalances({})
      setIsBalanceLoading(false)
      return
    }

    if (restoredCachedAddressKeyRef.current === activeAddressKey) {
      restoredCachedAddressKeyRef.current = null
      setIsBalanceLoading(false)
      return
    }

    let cancelled = false
    const cachedBalances = readCachedWalletBalances()
    const now = Date.now()
    const freshBalanceEntries = includedTrackedAssets.flatMap(asset => {
      const cachedBalance = getCachedWalletBalanceValue({
        cache: cachedBalances,
        addressKey: activeAddressKey,
        assetId: asset.id,
        maxAgeMs: walletBalanceCacheTtlMs
      })

      return cachedBalance == null ? [] : ([[asset.id, cachedBalance]] as const)
    })
    const freshBalanceAssetIds = new Set(
      freshBalanceEntries.map(([assetId]) => assetId)
    )
    const assetsToFetch = includedTrackedAssets.filter(
      asset => !freshBalanceAssetIds.has(asset.id)
    )

    if (freshBalanceEntries.length > 0) {
      setAssetBalances(currentBalances => ({
        ...currentBalances,
        ...Object.fromEntries(freshBalanceEntries)
      }))
    }
    if (assetsToFetch.length === 0) {
      setIsBalanceLoading(false)
      return
    }

    setIsBalanceLoading(true)
    Promise.all(
      assetsToFetch.map(async asset => {
        const option = getWalletNetworkOptionFrom(
          availableWalletNetworkOptions,
          asset.networkKey
        )
        try {
          const client = createWalletPublicClient(option)
          const balance =
            asset.type === 'native'
              ? await client.getBalance({ address: activeAccountAddress })
              : await client.readContract({
                  address: asset.tokenAddress!,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [activeAccountAddress]
                })
          cachedBalances[
            getWalletBalanceCacheKey({
              addressKey: activeAddressKey,
              assetId: asset.id
            })
          ] = { value: balance.toString(), fetchedAt: now }
          return [asset.id, balance] as const
        } catch (balanceError) {
          console.warn(
            `Unable to load ${asset.symbol} balance on ${option.label}:`,
            balanceError
          )
          const fallbackBalance = getCachedWalletBalanceValue({
            cache: cachedBalances,
            addressKey: activeAddressKey,
            assetId: asset.id,
            maxAgeMs: walletBalanceStaleFallbackTtlMs
          })
          return [asset.id, fallbackBalance] as const
        }
      })
    )
      .then(entries => {
        if (cancelled) return

        saveCachedWalletBalances(cachedBalances)
        setAssetBalances(currentBalances => ({
          ...currentBalances,
          ...Object.fromEntries(entries)
        }))
      })
      .finally(() => {
        if (!cancelled) setIsBalanceLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    activeAccountAddress,
    availableWalletNetworkOptions,
    balanceRefreshKey,
    includedTrackedAssets,
    portfolioStateAddressKey
  ])

  useEffect(() => {
    const assetsWithBalances = includedTrackedAssets.filter(
      asset =>
        asset.coingeckoId.trim() !== '' &&
        assetBalances[asset.id] != null &&
        assetBalances[asset.id] !== 0n
    )

    if (assetsWithBalances.length === 0) {
      setPortfolioHistory([])
      setIsPortfolioHistoryLoading(false)
      return
    }

    let cancelled = false
    setIsPortfolioHistoryLoading(true)
    Promise.all(
      Array.from(
        new Set(assetsWithBalances.map(asset => asset.coingeckoId.trim()))
      ).map(
        async priceId =>
          [
            priceId,
            await fetchAssetUsdHistory({ priceId, period: portfolioPeriod })
          ] as const
      )
    )
      .then(histories => {
        if (cancelled) return

        const historyByPriceId = Object.fromEntries(histories)
        const referenceHistory = histories.find(
          ([, history]) => history.length > 0
        )?.[1]
        if (referenceHistory == null) {
          setPortfolioHistory([])
          return
        }

        const points = referenceHistory.map(([timestamp], index) => {
          const valueUsd = assetsWithBalances.reduce((total, asset) => {
            const balance = assetBalances[asset.id]
            if (balance == null) return total

            const history = historyByPriceId[asset.coingeckoId.trim()]
            const price = history?.[index]?.[1]
            if (typeof price !== 'number') return total

            return total + Number(formatUnits(balance, asset.decimals)) * price
          }, 0)

          return {
            timestamp,
            value: valueUsd * usdConversionRate
          }
        })

        setPortfolioHistory(points)
      })
      .catch(historyError => {
        console.warn('Unable to load portfolio history:', historyError)
        if (!cancelled) setPortfolioHistory([])
      })
      .finally(() => {
        if (!cancelled) setIsPortfolioHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetBalances, includedTrackedAssets, portfolioPeriod, usdConversionRate])

  return {
    trackedWalletAssets,
    setTrackedWalletAssets,
    assetBalances,
    assetUsdPrices,
    usdConversionRate,
    isBalanceLoading,
    isPriceLoading,
    isPortfolioHistoryLoading,
    isDiscoveringAssets,
    portfolioHistory,
    portfolioCurrency,
    setPortfolioCurrency,
    portfolioPeriod,
    setPortfolioPeriod,
    customWalletNetworks,
    setCustomWalletNetworks,
    showTestWalletNetworks,
    setShowTestWalletNetworks,
    walletNetworkKey,
    setWalletNetworkKey,
    selectedWalletNetworkKeys,
    setSelectedWalletNetworkKeys,
    lastTransactionHash,
    setLastTransactionHash,
    balanceRefreshKey,
    setBalanceRefreshKey,
    availableWalletNetworkOptions,
    walletNetwork,
    selectedWalletNetworks,
    selectedNativeAssets,
    includedTrackedAssets,
    includedCustomAssets,
    trackedWalletAssetGroups,
    walletChain,
    walletRpcUrl,
    nativeAssetSymbol,
    selectedPortfolioValue,
    selectedPortfolioValueText,
    setVisibleWalletBalanceNetworks,
    toggleWalletBalanceNetwork,
    toggleTrackedWalletAsset,
    toggleTrackedWalletAssetGroup,
    addTrackedTokenAsset,
    removeTrackedTokenAsset,
    addCustomWalletNetwork,
    removeCustomWalletNetwork,
    discoverFundedWalletAssets,
    syncWalletBalances
  }
}
