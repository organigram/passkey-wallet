import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useWalletApp, useWalletPortfolioState } from './Context'
import { WalletActionDialog } from './WalletActionDialog'
import { PortfolioHistoryChart } from './PortfolioHistoryChart'
import {
  formatAssetBalance,
  formatAddress,
  formatCredentialId,
  formatCurrencyAmount,
  portfolioPeriods,
  type GasPriority,
  type WalletActionModal
} from '../helpers/wallet'

export const WalletPortfolioPanel = (): JSX.Element | null => {
  const [walletActionModal, setWalletActionModal] =
    useState<WalletActionModal>(null)
  const [sendDestination, setSendDestination] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendData, setSendData] = useState('')
  const [gasPriority, setGasPriority] = useState<GasPriority>('normal')
  const [showAssetDetails, setShowAssetDetails] = useState(false)
  const { activeAccountAddress, isBusy, sendNativeAsset } = useWalletApp()
  const {
    assetBalances,
    assetUsdPrices,
    availableWalletNetworkOptions,
    includedCustomAssets,
    includedTrackedAssets,
    isBalanceLoading,
    isDiscoveringAssets,
    isPortfolioHistoryLoading,
    isPriceLoading,
    lastTransactionHash,
    nativeAssetSymbol,
    portfolioCurrency,
    portfolioHistory,
    portfolioPeriod,
    selectedPortfolioValueText,
    selectedWalletNetworkKeys,
    setPortfolioPeriod,
    setWalletNetworkKey,
    syncWalletBalances,
    usdConversionRate,
    walletChain,
    walletRpcUrl,
    walletNetworkKey
  } = useWalletPortfolioState()
  const fundedAssetBreakdown = useMemo(
    () =>
      includedTrackedAssets
        .map(asset => {
          const balance = assetBalances[asset.id]
          if (balance == null || balance === 0n) return null

          const price =
            asset.coingeckoId.trim() === ''
              ? null
              : assetUsdPrices[asset.coingeckoId.trim()]
          const value =
            price == null
              ? null
              : Number(formatUnits(balance, asset.decimals)) *
                price *
                usdConversionRate
          const networkLabel =
            availableWalletNetworkOptions.find(
              option => option.key === asset.networkKey
            )?.label ?? asset.networkKey

          return {
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            networkLabel,
            balanceText: formatAssetBalance(balance, asset.decimals),
            value
          }
        })
        .filter((asset): asset is NonNullable<typeof asset> => asset != null)
        .sort((left, right) => (right.value ?? -1) - (left.value ?? -1)),
    [
      assetBalances,
      assetUsdPrices,
      availableWalletNetworkOptions,
      includedTrackedAssets,
      usdConversionRate
    ]
  )

  if (activeAccountAddress == null) return null

  return (
    <>
      {walletActionModal == null ? null : (
        <WalletActionDialog
          modal={walletActionModal}
          address={activeAccountAddress}
          chainId={walletChain.id}
          availableNetworks={availableWalletNetworkOptions}
          selectedNetworkKey={walletNetworkKey}
          nativeAssetSymbol={nativeAssetSymbol}
          sendDestination={sendDestination}
          sendAmount={sendAmount}
          sendData={sendData}
          gasPriority={gasPriority}
          isBusy={isBusy}
          onClose={() => setWalletActionModal(null)}
          onNetworkChange={setWalletNetworkKey}
          onSendDestinationChange={setSendDestination}
          onSendAmountChange={setSendAmount}
          onSendDataChange={setSendData}
          onGasPriorityChange={setGasPriority}
          onSend={async () => {
            await sendNativeAsset({
              amount: sendAmount,
              data: sendData,
              destination: sendDestination,
              gasPriority,
              walletChain,
              walletRpcUrl
            })
            setSendAmount('')
            setSendData('')
            setSendDestination('')
            setWalletActionModal(null)
          }}
          formatAddress={formatAddress}
        />
      )}
      <div className='panel wallet-funds-panel'>
        <div className='panel-heading wallet-funds-heading'>
          <div>
            <h2>Wallet</h2>
            <p>
              {selectedWalletNetworkKeys.length} network(s),{' '}
              {includedCustomAssets.length} token(s)
            </p>
          </div>
          <div className='wallet-balance'>
            <span>
              {isBalanceLoading || isPriceLoading ? 'Loading' : 'Total'}
            </span>
            <strong>{selectedPortfolioValueText}</strong>
          </div>
        </div>
        <div className='wallet-management-actions'>
          <button
            type='button'
            className='primary-button'
            onClick={() => setWalletActionModal('send')}
            disabled={isBusy}
          >
            Send
          </button>
          <button
            type='button'
            className='ghost-button'
            onClick={() => setWalletActionModal('receive')}
            disabled={isBusy}
          >
            Receive
          </button>
          <button
            type='button'
            className='ghost-button'
            onClick={syncWalletBalances}
            disabled={isBusy || isDiscoveringAssets}
          >
            Sync balances
          </button>
        </div>
        <div className='portfolio-history-panel'>
          <div className='portfolio-history-heading'>
            <span>Portfolio value</span>
            <div className='portfolio-period-control'>
              {portfolioPeriods.map(period => (
                <button
                  type='button'
                  className={
                    period.value === portfolioPeriod
                      ? 'priority-option priority-option-active'
                      : 'priority-option'
                  }
                  key={period.value}
                  onClick={() => setPortfolioPeriod(period.value)}
                  disabled={isBusy}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <PortfolioHistoryChart
            points={portfolioHistory}
            loading={isPortfolioHistoryLoading}
            formatValue={value =>
              formatCurrencyAmount(value, portfolioCurrency)
            }
          />
        </div>
        <button
          type='button'
          className='wallet-details-toggle text-button'
          onClick={() => setShowAssetDetails(value => !value)}
          disabled={isBusy || isBalanceLoading}
        >
          {showAssetDetails ? 'Hide details' : 'See details'}
        </button>
        {showAssetDetails ? (
          <div className='wallet-asset-breakdown'>
            {fundedAssetBreakdown.length === 0 ? (
              <small>No funded asset detected yet.</small>
            ) : (
              fundedAssetBreakdown.map(asset => (
                <div className='wallet-asset-breakdown-row' key={asset.id}>
                  <div>
                    <strong>{asset.symbol}</strong>
                    <span>
                      {asset.name} · {asset.networkLabel}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {asset.value == null
                        ? 'Price unavailable'
                        : formatCurrencyAmount(asset.value, portfolioCurrency)}
                    </strong>
                    <span>
                      {asset.balanceText} {asset.symbol}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
        {lastTransactionHash == null ? null : (
          <small className='last-transaction-hash'>
            Last transaction {formatCredentialId(lastTransactionHash)}
          </small>
        )}
      </div>
    </>
  )
}
