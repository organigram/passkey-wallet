import defaultRuntimeConfig from '../../public/passkey-wallet.config.json'

const walletRuntimeIdentity = {
  title: 'Sign, send, forget.',
  subtitle:
    'A minimal, client-side wallet providing passkeys credentials, key rotation, backup and recovery. Auditable, free and open source, you can run it locally to sign, send or receive funds, or authenticate users to your own domain. Keys are encrypted locally and never leave the browser.',
  githubUrl: 'https://github.com/organigram/passkey-wallet'
} as const

export type WalletRuntimeThemeConfig = {
  logoUrl: string
  backgroundUrl: string
  accentColor: string
  surfaceColor: string
  textColor: string
}

export type WalletRuntimeConfig = {
  version: number
  brandName: string
  title: string
  tagline: string
  subtitle: string
  githubUrl: string
  stackOrigin: string
  defaultChainId: number
  defaultRpcUrl: string
  theme: WalletRuntimeThemeConfig
}

const defaultWalletRuntimeConfig = {
  ...defaultRuntimeConfig,
  ...walletRuntimeIdentity
} satisfies WalletRuntimeConfig

let runtimeConfig: WalletRuntimeConfig = defaultWalletRuntimeConfig

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value)

const readString = (
  value: unknown,
  fallback: string,
  validate: (value: string) => boolean = candidate => candidate.trim() !== ''
): string => {
  if (typeof value !== 'string') return fallback

  const trimmed = value.trim()
  return validate(trimmed) ? trimmed : fallback
}

const readUrl = (value: unknown, fallback: string): string =>
  readString(value, fallback, candidate => {
    if (candidate.startsWith('/')) return !candidate.startsWith('//')

    try {
      const url = new URL(candidate)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  })

const readHttpsOrigin = (value: unknown, fallback: string): string =>
  readString(value, fallback, candidate => {
    try {
      const url = new URL(candidate)
      return url.protocol === 'https:' && url.origin === candidate
    } catch {
      return false
    }
  })

const readColor = (value: unknown, fallback: string): string =>
  readString(value, fallback, candidate =>
    /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/.test(candidate)
  )

const readPositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : fallback

const parseRuntimeConfig = (value: unknown): WalletRuntimeConfig => {
  if (!isRecord(value) || value.version !== 1) {
    return defaultWalletRuntimeConfig
  }

  const theme = isRecord(value.theme) ? value.theme : {}

  return {
    version: 1,
    brandName: readString(value.brandName, defaultWalletRuntimeConfig.brandName),
    title: walletRuntimeIdentity.title,
    tagline: readString(value.tagline, defaultWalletRuntimeConfig.tagline),
    subtitle: walletRuntimeIdentity.subtitle,
    githubUrl: walletRuntimeIdentity.githubUrl,
    stackOrigin: readHttpsOrigin(
      value.stackOrigin,
      defaultWalletRuntimeConfig.stackOrigin
    ),
    defaultChainId: readPositiveInteger(
      value.defaultChainId,
      defaultWalletRuntimeConfig.defaultChainId
    ),
    defaultRpcUrl: readUrl(
      value.defaultRpcUrl,
      defaultWalletRuntimeConfig.defaultRpcUrl
    ),
    theme: {
      logoUrl: readUrl(theme.logoUrl, defaultWalletRuntimeConfig.theme.logoUrl),
      backgroundUrl: readUrl(
        theme.backgroundUrl,
        defaultWalletRuntimeConfig.theme.backgroundUrl
      ),
      accentColor: readColor(
        theme.accentColor,
        defaultWalletRuntimeConfig.theme.accentColor
      ),
      surfaceColor: readColor(
        theme.surfaceColor,
        defaultWalletRuntimeConfig.theme.surfaceColor
      ),
      textColor: readColor(
        theme.textColor,
        defaultWalletRuntimeConfig.theme.textColor
      )
    }
  }
}

const applyRuntimeTheme = (config: WalletRuntimeConfig): void => {
  document.documentElement.style.setProperty(
    '--wallet-logo-url',
    `url("${config.theme.logoUrl}")`
  )
  document.documentElement.style.setProperty(
    '--wallet-background-image',
    `url("${config.theme.backgroundUrl}")`
  )
  document.documentElement.style.setProperty(
    '--wallet-accent',
    config.theme.accentColor
  )
  document.documentElement.style.setProperty(
    '--wallet-hero-surface',
    config.theme.surfaceColor
  )
  document.documentElement.style.setProperty(
    '--wallet-text',
    config.theme.textColor
  )
  document.title = config.brandName
}

export const loadWalletRuntimeConfig =
  async (): Promise<WalletRuntimeConfig> => {
    try {
      const response = await fetch('/passkey-wallet.config.json', {
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error(`Config request failed: ${response.status}`)
      }

      runtimeConfig = parseRuntimeConfig(await response.json())
    } catch {
      runtimeConfig = defaultWalletRuntimeConfig
    }

    applyRuntimeTheme(runtimeConfig)
    return runtimeConfig
  }

export const getWalletRuntimeConfig = (): WalletRuntimeConfig => runtimeConfig
