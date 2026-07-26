import { useEffect, useState } from 'react'
import { NetworkIcon } from '../Icons'
import { useWalletApp, useWalletPortfolioState } from '../Context'
import {
  formatAssetBalance,
  formatCredentialId,
  getWalletNetworkOptionFrom,
  type WalletNetworkKey
} from '../../helpers/wallet'

export const TokenSettingsPanel = (): JSX.Element => {
  const [isAddingTrackedAsset, setIsAddingTrackedAsset] = useState(false)
  const [assetFormNetworkKey, setAssetFormNetworkKey] =
    useState<WalletNetworkKey>('ethereum')
  const [assetFormName, setAssetFormName] = useState('')
  const [assetFormSymbol, setAssetFormSymbol] = useState('')
  const [assetFormAddress, setAssetFormAddress] = useState('')
  const [assetFormDecimals, setAssetFormDecimals] = useState('18')
  const [assetFormCoingeckoId, setAssetFormCoingeckoId] = useState('')
  const [expandedAssetGroupKeys, setExpandedAssetGroupKeys] = useState<
    Set<string>
  >(() => new Set())
  const { isBusy } = useWalletApp()
  const {
    addTrackedTokenAsset,
    assetBalances,
    availableWalletNetworkOptions,
    removeTrackedTokenAsset,
    toggleTrackedWalletAsset,
    toggleTrackedWalletAssetGroup,
    trackedWalletAssetGroups,
    trackedWalletAssets
  } = useWalletPortfolioState()

  useEffect(() => {
    if (
      availableWalletNetworkOptions.some(
        option => option.key === assetFormNetworkKey
      )
    ) {
      return
    }

    setAssetFormNetworkKey(availableWalletNetworkOptions[0]?.key ?? 'ethereum')
  }, [assetFormNetworkKey, availableWalletNetworkOptions])

  const resetTrackedAssetForm = (): void => {
    setAssetFormName('')
    setAssetFormSymbol('')
    setAssetFormAddress('')
    setAssetFormDecimals('18')
    setAssetFormCoingeckoId('')
  }

  const toggleExpandedAssetGroup = (groupKey: string): void => {
    setExpandedAssetGroupKeys(currentKeys => {
      const nextKeys = new Set(currentKeys)
      if (nextKeys.has(groupKey)) {
        nextKeys.delete(groupKey)
      } else {
        nextKeys.add(groupKey)
      }

      return nextKeys
    })
  }

  const tokensSettingsPanel = (
    <section className='settings-card tracked-assets-panel'>
      <div className='settings-card-heading'>
        <div>
          <h2>Tokens</h2>
          <p>Add and toggle assets tracked for this wallet.</p>
        </div>
      </div>
      <div className='tracked-asset-list'>
        {trackedWalletAssets.length === 0 ? (
          <div className='settings-empty-row'>
            Native assets are tracked automatically through active networks.
          </div>
        ) : null}
        {trackedWalletAssetGroups.map(group => {
          const enabledCount = group.assets.filter(
            asset => asset.enabled
          ).length
          const isGroupEnabled = enabledCount > 0
          const assetIds = group.assets.map(asset => asset.id)
          const isExpanded = expandedAssetGroupKeys.has(group.key)

          return (
            <section
              className={
                isExpanded
                  ? 'tracked-asset-group tracked-asset-group-expanded'
                  : 'tracked-asset-group'
              }
              key={group.key}
            >
              <div className='tracked-asset-group-heading'>
                <button
                  type='button'
                  className={
                    isGroupEnabled
                      ? 'asset-toggle asset-toggle-active'
                      : 'asset-toggle'
                  }
                  onClick={() => toggleTrackedWalletAssetGroup(assetIds)}
                  disabled={isBusy}
                  aria-pressed={isGroupEnabled}
                >
                  {group.symbol.slice(0, 4)}
                </button>
                <button
                  type='button'
                  className='tracked-asset-group-trigger'
                  onClick={() => toggleExpandedAssetGroup(group.key)}
                  aria-expanded={isExpanded}
                >
                  <span>
                    <strong>{group.symbol}</strong>
                    <small>
                      {group.name} · {group.assets.length}{' '}
                      {group.assets.length === 1 ? 'network' : 'networks'}
                    </small>
                  </span>
                  <em>
                    {enabledCount}/{group.assets.length} active
                  </em>
                  <span className='asset-accordion-indicator'>
                    {isExpanded ? 'Hide' : 'Show'}
                  </span>
                </button>
              </div>
              {isExpanded ? (
                <div className='tracked-asset-network-list'>
                  {group.assets.map(asset => {
                    const network = getWalletNetworkOptionFrom(
                      availableWalletNetworkOptions,
                      asset.networkKey
                    )
                    const balance = assetBalances[asset.id]
                    const balanceText =
                      balance == null
                        ? '-'
                        : `${formatAssetBalance(balance, asset.decimals)} ${asset.symbol}`

                    return (
                      <div className='tracked-asset-row' key={asset.id}>
                        <button
                          type='button'
                          className={
                            asset.enabled
                              ? 'asset-network-toggle asset-network-toggle-active'
                              : 'asset-network-toggle'
                          }
                          onClick={() => toggleTrackedWalletAsset(asset.id)}
                          disabled={isBusy}
                          aria-pressed={asset.enabled}
                          title={network.label}
                        >
                          <span className='wallet-network-icon'>
                            <NetworkIcon
                              kind={network.key}
                              label={network.label}
                            />
                          </span>
                        </button>
                        <div>
                          <strong>{network.label}</strong>
                          <small>
                            {formatCredentialId(asset.tokenAddress ?? '0x')}
                          </small>
                        </div>
                        <em>{balanceText}</em>
                        <button
                          type='button'
                          className='text-button'
                          onClick={() => removeTrackedTokenAsset(asset.id)}
                          disabled={isBusy}
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
      <div className='settings-card-actions'>
        <button
          type='button'
          className='ghost-button'
          onClick={() => setIsAddingTrackedAsset((value: boolean) => !value)}
          disabled={isBusy}
        >
          {isAddingTrackedAsset ? 'Cancel' : 'Add token'}
        </button>
      </div>
      {isAddingTrackedAsset ? (
        <div className='asset-add-form'>
          <select
            value={assetFormNetworkKey}
            onChange={event =>
              setAssetFormNetworkKey(event.target.value as WalletNetworkKey)
            }
            disabled={isBusy}
          >
            {availableWalletNetworkOptions.map(option => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={assetFormName}
            onChange={event => setAssetFormName(event.target.value)}
            placeholder='Token name'
          />
          <input
            value={assetFormSymbol}
            onChange={event => setAssetFormSymbol(event.target.value)}
            placeholder='Symbol'
          />
          <input
            value={assetFormAddress}
            onChange={event => setAssetFormAddress(event.target.value)}
            placeholder='Contract address'
          />
          <input
            value={assetFormDecimals}
            onChange={event => setAssetFormDecimals(event.target.value)}
            inputMode='numeric'
            placeholder='Decimals'
          />
          <input
            value={assetFormCoingeckoId}
            onChange={event => setAssetFormCoingeckoId(event.target.value)}
            placeholder='CoinGecko id'
          />
          <button
            type='button'
            className='ghost-button'
            onClick={() => {
              const added = addTrackedTokenAsset({
                networkKey: assetFormNetworkKey,
                name: assetFormName,
                symbol: assetFormSymbol,
                address: assetFormAddress,
                decimals: assetFormDecimals,
                coingeckoId: assetFormCoingeckoId
              })
              if (!added) return

              resetTrackedAssetForm()
              setIsAddingTrackedAsset(false)
            }}
            disabled={isBusy}
          >
            Save token
          </button>
        </div>
      ) : null}
    </section>
  )

  return tokensSettingsPanel
}
