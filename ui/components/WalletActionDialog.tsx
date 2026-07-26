import { QRCodeSVG } from 'qrcode.react'

import { NetworkIcon } from './Icons'

type WalletActionModal = 'receive' | 'send'
type GasPriority = 'slow' | 'normal' | 'fast'

type WalletNetworkOption = {
  key: string
  label: string
}

export const WalletActionDialog = ({
  modal,
  address,
  chainId,
  availableNetworks,
  selectedNetworkKey,
  nativeAssetSymbol,
  sendDestination,
  sendAmount,
  sendData,
  gasPriority,
  isBusy,
  onClose,
  onNetworkChange,
  onSendDestinationChange,
  onSendAmountChange,
  onSendDataChange,
  onGasPriorityChange,
  onSend,
  formatAddress
}: {
  modal: WalletActionModal
  address: `0x${string}`
  chainId: number
  availableNetworks: WalletNetworkOption[]
  selectedNetworkKey: string
  nativeAssetSymbol: string
  sendDestination: string
  sendAmount: string
  sendData: string
  gasPriority: GasPriority
  isBusy: boolean
  onClose: () => void
  onNetworkChange: (key: string) => void
  onSendDestinationChange: (value: string) => void
  onSendAmountChange: (value: string) => void
  onSendDataChange: (value: string) => void
  onGasPriorityChange: (priority: GasPriority) => void
  onSend: () => void
  formatAddress: (address: string) => string
}): JSX.Element => (
  <div className='modal-backdrop' role='presentation'>
    <div
      className='wallet-action-modal'
      role='dialog'
      aria-modal='true'
      aria-label={modal === 'receive' ? 'Receive funds' : 'Send funds'}
    >
      <div className='modal-heading'>
        <div>
          <h2>{modal === 'receive' ? 'Receive' : 'Send'}</h2>
          <p>{formatAddress(address)}</p>
        </div>
        <button type='button' className='text-button' onClick={onClose}>
          Close
        </button>
      </div>

      {modal === 'receive' ? (
        <div className='receive-modal-content'>
          <div className='qr-frame'>
            <QRCodeSVG
              value={`ethereum:${address}@${chainId}`}
              size={220}
              includeMargin
            />
          </div>
          <code>{address}</code>
          <button
            type='button'
            className='ghost-button'
            onClick={() => {
              navigator.clipboard.writeText(address).catch(clipboardError => {
                console.warn('Unable to copy address:', clipboardError)
              })
            }}
          >
            Copy address
          </button>
        </div>
      ) : (
        <div className='send-modal-content'>
          <div className='send-network-selector'>
            <span>Network</span>
            <div className='wallet-network-grid'>
              {availableNetworks.map(option => {
                const isSelected = option.key === selectedNetworkKey

                return (
                  <button
                    type='button'
                    className={
                      isSelected
                        ? 'wallet-network-tile wallet-network-tile-active'
                        : 'wallet-network-tile'
                    }
                    key={option.key}
                    onClick={() => onNetworkChange(option.key)}
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
          <label>
            Destination
            <input
              value={sendDestination}
              onChange={event => onSendDestinationChange(event.target.value)}
              placeholder='0x...'
            />
          </label>
          <label>
            Amount
            <input
              value={sendAmount}
              onChange={event => onSendAmountChange(event.target.value)}
              inputMode='decimal'
              placeholder={`0.00 ${nativeAssetSymbol}`}
            />
          </label>
          <label>
            Data
            <textarea
              value={sendData}
              onChange={event => onSendDataChange(event.target.value)}
              rows={3}
              placeholder='0x'
            />
          </label>
          <label>
            Priority
            <div className='gas-priority-control'>
              {(['slow', 'normal', 'fast'] as GasPriority[]).map(priority => (
                <button
                  type='button'
                  className={
                    gasPriority === priority
                      ? 'priority-option priority-option-active'
                      : 'priority-option'
                  }
                  key={priority}
                  onClick={() => onGasPriorityChange(priority)}
                >
                  {priority}
                </button>
              ))}
            </div>
          </label>
          <button
            type='button'
            className='primary-button'
            onClick={onSend}
            disabled={
              isBusy ||
              sendDestination.trim() === '' ||
              sendAmount.trim() === ''
            }
          >
            Send {nativeAssetSymbol}
          </button>
        </div>
      )}
    </div>
  </div>
)
