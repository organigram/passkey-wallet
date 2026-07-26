import type { StoredVaultRecord } from '../helpers/storage'

type PasskeyDeviceKind = NonNullable<StoredVaultRecord['passkeyDevice']>['kind']

type PasskeyDeviceInfo = {
  kind: PasskeyDeviceKind
  label: string
}

export const getPasskeyDeviceInfo = (
  record: StoredVaultRecord
): PasskeyDeviceInfo => record.passkeyDevice

const PasskeyDeviceIcon = ({
  kind
}: {
  kind: PasskeyDeviceKind
}): JSX.Element => {
  if (kind === 'macos' || kind === 'ios' || kind === 'ipados') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M16.8 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.5-1.7-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 2-1 2.7-2.1.8-1.2 1.1-2.3 1.1-2.4 0-.1-2.5-1-2.5-3.4ZM14.8 6.4c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 0 1.9-.5 2.5-1.2Z' />
      </svg>
    )
  }
  if (kind === 'windows') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M4 5.1 10.9 4v7.1H4V5.1Zm8.1-1.3L20 2.7v8.4h-7.9V3.8ZM4 12.3h6.9v7.4L4 18.6v-6.3Zm8.1 0H20v9l-7.9-1.2v-7.8Z' />
      </svg>
    )
  }
  if (kind === 'android') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='m7.2 8.4-1.7-3 .9-.5 1.7 3c1.1-.5 2.4-.8 3.9-.8s2.8.3 3.9.8l1.7-3 .9.5-1.7 3c1.6 1.1 2.6 2.7 2.6 4.6v.5H4.6V13c0-1.9 1-3.5 2.6-4.6Zm1.6 3.1c.4 0 .8-.4.8-.8s-.4-.8-.8-.8-.8.4-.8.8.4.8.8.8Zm6.4 0c.4 0 .8-.4.8-.8s-.4-.8-.8-.8-.8.4-.8.8.4.8.8.8ZM5.4 14.7h13.2v4c0 .9-.7 1.6-1.6 1.6H7c-.9 0-1.6-.7-1.6-1.6v-4Z' />
      </svg>
    )
  }
  if (kind === 'security-key') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M8.9 14.5a5 5 0 1 1 3.4 3.4l-1.2 1.2H9v2H6.8v2H3v-3.8l5.9-4.8Zm5.8-.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z' />
      </svg>
    )
  }
  if (kind === 'cross-device') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M8 2.8h8c1 0 1.8.8 1.8 1.8v14.8c0 1-.8 1.8-1.8 1.8H8c-1 0-1.8-.8-1.8-1.8V4.6c0-1 .8-1.8 1.8-1.8Zm.4 2.4v12.6h7.2V5.2H8.4Zm2.4 14.3h2.4v-.9h-2.4v.9Z' />
      </svg>
    )
  }
  if (kind === 'linux') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M6 5.4C6 4.1 7.1 3 8.4 3h7.2C16.9 3 18 4.1 18 5.4v13.2c0 1.3-1.1 2.4-2.4 2.4H8.4C7.1 21 6 19.9 6 18.6V5.4Zm2 1.2v9.8h8V6.6H8Zm1.2 11.3v1.2h5.6v-1.2H9.2Z' />
      </svg>
    )
  }

  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <path d='M12 2.8c3.8 0 6.9 2.9 7.2 6.6.1.7-.5 1.3-1.2 1.3-.6 0-1.1-.5-1.2-1.1A4.8 4.8 0 0 0 12 5.2a4.8 4.8 0 0 0-4.8 4.4c-.1.6-.6 1.1-1.2 1.1-.7 0-1.2-.6-1.2-1.3C5.1 5.7 8.2 2.8 12 2.8Zm0 4.4a2.8 2.8 0 0 1 2.8 2.7c.1 3.2 1.4 5.3 3.1 6.6.6.4.7 1.2.3 1.7-.4.5-1.2.6-1.7.2-2.3-1.7-4-4.5-4.1-8.4 0-.3-.2-.5-.4-.5s-.4.2-.4.5c-.1 2.6-.7 4.7-1.8 6.3-.5.8-1.2 1.5-1.9 2-.5.4-1.3.3-1.7-.2-.4-.5-.3-1.3.2-1.7.5-.4 1-.9 1.4-1.5.8-1.2 1.3-2.8 1.4-4.9A2.8 2.8 0 0 1 12 7.2Zm-1 11.2c.2-.6.9-1 1.5-.8.8.2 1.7.4 2.6.4.7 0 1.2.5 1.2 1.2s-.5 1.2-1.2 1.2c-1.1 0-2.3-.2-3.4-.6-.6-.2-.9-.8-.7-1.4Z' />
    </svg>
  )
}

export const PasskeyDeviceMark = ({
  record
}: {
  record: StoredVaultRecord
}): JSX.Element => {
  const device = getPasskeyDeviceInfo(record)

  return (
    <span
      className={`passkey-device-mark passkey-device-${device.kind}`}
      role='img'
      aria-label={device.label}
      title={device.label}
    >
      <PasskeyDeviceIcon kind={device.kind} />
    </span>
  )
}
