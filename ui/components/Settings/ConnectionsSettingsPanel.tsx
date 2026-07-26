import { useMemo } from 'react'
import { useWalletApp } from '../Context'
import { formatAddress, formatDate } from '../../helpers/wallet'
import {
  isActiveWalletConnectionKind,
  type WalletConnectionRecord,
  type WalletPendingConnectionRequest
} from '../../helpers/walletConnections'

const getConnectionKindLabel = (record: WalletConnectionRecord): string => {
  if (record.kind === 'connect') return 'Connect'
  return 'Sign in'
}

const getRequestKindLabel = (
  request: WalletPendingConnectionRequest
): string => {
  if (request.kind === 'connect') return 'Connect'
  if (request.kind === 'sign-in') return 'Sign in'
  return 'Sign message'
}

const WalletConnectionRow = ({
  record,
  isBusy,
  onRevoke
}: {
  record: WalletConnectionRecord
  isBusy: boolean
  onRevoke: (id: string) => void | Promise<void>
}): JSX.Element => (
  <div className='wallet-connection-row'>
    <div>
      <strong>{record.domain}</strong>
      <small>
        {getConnectionKindLabel(record)} · {formatAddress(record.address)} ·
        chain {record.chainId}
      </small>
      {record.appOrigin == null ? null : <small>{record.appOrigin}</small>}
    </div>
    <div className='wallet-connection-meta'>
      <span
        className={
          record.revokedAt == null
            ? 'wallet-connection-status wallet-connection-status-active'
            : 'wallet-connection-status'
        }
      >
        Active
      </span>
      <small>{formatDate(record.completedAt)}</small>
      <button
        type='button'
        className='text-button'
        onClick={() => {
          onRevoke(record.id)
        }}
        disabled={isBusy}
      >
        Revoke
      </button>
    </div>
  </div>
)

const WalletPendingConnectionRow = ({
  request,
  isBusy,
  onApprove
}: {
  request: WalletPendingConnectionRequest
  isBusy: boolean
  onApprove: (request: WalletPendingConnectionRequest) => void | Promise<void>
}): JSX.Element => (
  <div className='wallet-connection-row'>
    <div>
      <strong>{request.domain}</strong>
      <small>
        {getRequestKindLabel(request)}
        {request.address == null ? '' : ` · ${formatAddress(request.address)}`}
        {request.chainId == null ? '' : ` · chain ${request.chainId}`}
      </small>
      {request.appOrigin == null ? null : <small>{request.appOrigin}</small>}
    </div>
    <div className='wallet-connection-meta'>
      <span className='wallet-connection-status wallet-connection-status-pending'>
        Pending
      </span>
      <small>Expires {formatDate(request.expiresAt)}</small>
      <button
        type='button'
        className='text-button wallet-connection-approve-link'
        onClick={() => {
          onApprove(request)
        }}
        disabled={isBusy}
      >
        Approve
      </button>
    </div>
  </div>
)

export const ConnectionsSettingsPanel = (): JSX.Element => {
  const {
    approvePendingConnectionRequest,
    isBusy,
    revokeWalletConnection,
    walletConnectionRecords,
    walletPendingConnectionRequests
  } = useWalletApp()
  const activeConnections = useMemo(
    () =>
      walletConnectionRecords.filter(
        record =>
          isActiveWalletConnectionKind(record.kind) && record.revokedAt == null
      ),
    [walletConnectionRecords]
  )

  return (
    <section className='registry-section wallet-connections-section'>
      <div className='registry-heading'>
        <div>
          <h2>Connections</h2>
          <p>Approved wallet requests for apps connected to this browser.</p>
        </div>
      </div>

      <div className='wallet-connections-list'>
        <div className='wallet-connections-group'>
          <h3>Pending requests</h3>
          {walletPendingConnectionRequests.length === 0 ? (
            <div className='empty-row'>No pending wallet request.</div>
          ) : (
            walletPendingConnectionRequests.map(request => (
              <WalletPendingConnectionRow
                key={`${request.id}:${request.requestedAt}:pending`}
                request={request}
                isBusy={isBusy}
                onApprove={approvePendingConnectionRequest}
              />
            ))
          )}
        </div>

        <div className='wallet-connections-group'>
          <h3>Active connections</h3>
          {activeConnections.length === 0 ? (
            <div className='empty-row'>No active wallet connection.</div>
          ) : (
            activeConnections.map(record => (
              <WalletConnectionRow
                key={`${record.id}:${record.requestId}:active`}
                record={record}
                isBusy={isBusy}
                onRevoke={revokeWalletConnection}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
