import { useState } from 'react'
import { NetworkIcon } from '../Icons'
import { useWalletApp, useWalletPortfolioState } from '../Context'

export const NetworkSettingsPanel = (): JSX.Element => {
  const [isAddingCustomNetwork, setIsAddingCustomNetwork] = useState(false)
  const [networkFormName, setNetworkFormName] = useState('')
  const [networkFormChainId, setNetworkFormChainId] = useState('')
  const [networkFormRpcUrl, setNetworkFormRpcUrl] = useState('')
  const [networkFormCurrencyName, setNetworkFormCurrencyName] =
    useState('Ether')
  const [networkFormCurrencySymbol, setNetworkFormCurrencySymbol] =
    useState('ETH')
  const [networkFormCurrencyDecimals, setNetworkFormCurrencyDecimals] =
    useState('18')
  const [networkFormCoingeckoId, setNetworkFormCoingeckoId] = useState('')
  const { isBusy } = useWalletApp()
  const {
    addCustomWalletNetwork,
    availableWalletNetworkOptions,
    customWalletNetworks,
    removeCustomWalletNetwork,
    selectedWalletNetworkKeys,
    setVisibleWalletBalanceNetworks,
    setShowTestWalletNetworks,
    showTestWalletNetworks,
    toggleWalletBalanceNetwork
  } = useWalletPortfolioState()
  const areAllVisibleNetworksSelected =
    availableWalletNetworkOptions.length > 0 &&
    availableWalletNetworkOptions.every(option =>
      selectedWalletNetworkKeys.includes(option.key)
    )

  const resetCustomNetworkForm = (): void => {
    setNetworkFormName('')
    setNetworkFormChainId('')
    setNetworkFormRpcUrl('')
    setNetworkFormCurrencyName('Ether')
    setNetworkFormCurrencySymbol('ETH')
    setNetworkFormCurrencyDecimals('18')
    setNetworkFormCoingeckoId('')
  }

  const networksSettingsPanel = (
    <section className='settings-card'>
      <div className='settings-card-heading'>
        <div>
          <h2>Networks</h2>
          <p>Select the networks included in the portfolio balance.</p>
        </div>
      </div>
      <div className='wallet-network-selector'>
        <div className='wallet-network-selector-heading'>
          <span>Balance networks</span>
          <button
            type='button'
            className='text-button'
            onClick={() =>
              setVisibleWalletBalanceNetworks(!areAllVisibleNetworksSelected)
            }
            disabled={isBusy || availableWalletNetworkOptions.length === 0}
          >
            {areAllVisibleNetworksSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className='wallet-network-grid'>
          {availableWalletNetworkOptions.map(option => {
            const isSelected = selectedWalletNetworkKeys.includes(option.key)

            return (
              <button
                type='button'
                className={
                  isSelected
                    ? 'wallet-network-tile wallet-network-tile-active'
                    : 'wallet-network-tile'
                }
                key={option.key}
                onClick={() => toggleWalletBalanceNetwork(option.key)}
                disabled={isBusy}
                title={option.label}
                aria-label={option.label}
                aria-pressed={isSelected}
                data-label={option.label}
              >
                <span className='wallet-network-icon'>
                  <NetworkIcon kind={option.key} label={option.label} />
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {customWalletNetworks.length > 0 ? (
        <div className='custom-network-list'>
          {customWalletNetworks.map(network => (
            <div className='custom-network-row' key={network.key}>
              <div>
                <strong>{network.label}</strong>
                <small>
                  Chain {network.chainId} · {network.nativeCurrencySymbol}
                </small>
              </div>
              <button
                type='button'
                className='text-button'
                onClick={() => removeCustomWalletNetwork(network.key)}
                disabled={isBusy}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className='settings-card-actions'>
        <button
          type='button'
          className='ghost-button'
          onClick={() => setIsAddingCustomNetwork((value: boolean) => !value)}
          disabled={isBusy}
        >
          {isAddingCustomNetwork ? 'Cancel' : 'Add custom network'}
        </button>
        <label className='settings-switch'>
          <input
            type='checkbox'
            checked={showTestWalletNetworks}
            onChange={event => setShowTestWalletNetworks(event.target.checked)}
            disabled={isBusy}
          />
          <span aria-hidden='true' />
          <strong>Show test networks</strong>
        </label>
      </div>
      {isAddingCustomNetwork ? (
        <div className='custom-network-form'>
          <input
            value={networkFormName}
            onChange={event => setNetworkFormName(event.target.value)}
            placeholder='Network name'
          />
          <input
            value={networkFormChainId}
            onChange={event => setNetworkFormChainId(event.target.value)}
            inputMode='numeric'
            placeholder='Chain ID'
          />
          <input
            value={networkFormRpcUrl}
            onChange={event => setNetworkFormRpcUrl(event.target.value)}
            placeholder='RPC URL'
          />
          <input
            value={networkFormCurrencyName}
            onChange={event => setNetworkFormCurrencyName(event.target.value)}
            placeholder='Native currency name'
          />
          <input
            value={networkFormCurrencySymbol}
            onChange={event => setNetworkFormCurrencySymbol(event.target.value)}
            placeholder='Native currency symbol'
          />
          <input
            value={networkFormCurrencyDecimals}
            onChange={event =>
              setNetworkFormCurrencyDecimals(event.target.value)
            }
            inputMode='numeric'
            placeholder='Decimals'
          />
          <input
            value={networkFormCoingeckoId}
            onChange={event => setNetworkFormCoingeckoId(event.target.value)}
            placeholder='CoinGecko id (optional)'
          />
          <button
            type='button'
            className='ghost-button'
            onClick={() => {
              const added = addCustomWalletNetwork({
                name: networkFormName,
                chainId: networkFormChainId,
                rpcUrl: networkFormRpcUrl,
                currencyName: networkFormCurrencyName,
                currencySymbol: networkFormCurrencySymbol,
                currencyDecimals: networkFormCurrencyDecimals,
                coingeckoId: networkFormCoingeckoId
              })
              if (!added) return

              resetCustomNetworkForm()
              setIsAddingCustomNetwork(false)
            }}
            disabled={isBusy}
          >
            Save custom network
          </button>
        </div>
      ) : null}
    </section>
  )

  return networksSettingsPanel
}
