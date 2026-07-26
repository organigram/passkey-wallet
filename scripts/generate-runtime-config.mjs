import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageDir = join(scriptDir, '..')
const defaultConfigPath = join(packageDir, 'public/passkey-wallet.config.json')

const normalizeProfile = value =>
  typeof value === 'string'
    ? value
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()
    : ''

const parseArgs = args => {
  const options = {
    configPath: defaultConfigPath,
    outPath: defaultConfigPath,
    profile: normalizeProfile(
      process.env.PASSKEY_WALLET_PROFILE ??
        process.env.VERCEL_GIT_COMMIT_REF ??
        process.env.VERCEL_ENV
    )
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--config') {
      if (next == null) throw new Error('--config requires a path.')
      options.configPath = next
      index += 1
      continue
    }
    if (arg === '--out') {
      if (next == null) throw new Error('--out requires a path.')
      options.outPath = next
      index += 1
      continue
    }
    if (arg === '--profile') {
      if (next == null) throw new Error('--profile requires a value.')
      options.profile = normalizeProfile(next)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

const isRecord = value =>
  typeof value === 'object' && value != null && !Array.isArray(value)

const requireString = (value, field) => {
  if (typeof value !== 'string') {
    throw new Error(`Runtime config field ${field} must be a string.`)
  }
  return value
}

const readRuntimeConfig = async configPath => {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  if (!isRecord(config) || config.version !== 1) {
    throw new Error('Runtime config must be an object with version: 1.')
  }
  if (!isRecord(config.theme)) {
    throw new Error('Runtime config must include a theme object.')
  }

  return config
}

const envCandidates = (profile, key) => [
  ...(profile === '' ? [] : [`PASSKEY_WALLET_${profile}_${key}`]),
  `PASSKEY_WALLET_${key}`
]

const readEnv = (profile, key, fallback) => {
  for (const envKey of envCandidates(profile, key)) {
    const value = process.env[envKey]
    if (value != null && value.trim() !== '') return value.trim()
  }

  return fallback
}

const readString = (profile, key, fallback) =>
  readEnv(profile, key, requireString(fallback, key))

const readHttpsOrigin = (profile, key, fallback) => {
  const value = readString(profile, key, fallback)
  if (value === '') return value

  const url = new URL(value)
  if (url.protocol !== 'https:' || url.origin !== value) {
    throw new Error(`PASSKEY_WALLET_${key} must be an HTTPS origin.`)
  }

  return url.origin
}

const readUrl = (profile, key, fallback) => {
  const value = readString(profile, key, fallback)
  if (value === '') return value
  if (value.startsWith('/') && !value.startsWith('//')) return value

  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`PASSKEY_WALLET_${key} must be an HTTP(S) URL or a path.`)
  }

  return url.toString()
}

const readColor = (profile, key, fallback) => {
  const value = readString(profile, key, fallback)
  if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/.test(value)) {
    throw new Error(`PASSKEY_WALLET_${key} must be a CSS color.`)
  }

  return value
}

const readPositiveInteger = (profile, key, fallback) => {
  const raw = readEnv(profile, key, String(fallback))
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`PASSKEY_WALLET_${key} must be a positive integer.`)
  }

  return value
}

const createRuntimeConfig = (currentConfig, profile) => ({
  version: 1,
  brandName: readString(profile, 'BRAND_NAME', currentConfig.brandName),
  tagline: readString(profile, 'TAGLINE', currentConfig.tagline),
  stackOrigin: readHttpsOrigin(
    profile,
    'STACK_ORIGIN',
    currentConfig.stackOrigin
  ),
  defaultChainId: readPositiveInteger(
    profile,
    'DEFAULT_CHAIN_ID',
    currentConfig.defaultChainId
  ),
  defaultRpcUrl: readUrl(
    profile,
    'DEFAULT_RPC_URL',
    currentConfig.defaultRpcUrl
  ),
  theme: {
    logoUrl: readUrl(profile, 'LOGO_URL', currentConfig.theme.logoUrl),
    backgroundUrl: readUrl(
      profile,
      'BACKGROUND_URL',
      currentConfig.theme.backgroundUrl
    ),
    accentColor: readColor(
      profile,
      'ACCENT_COLOR',
      currentConfig.theme.accentColor
    ),
    surfaceColor: readColor(
      profile,
      'SURFACE_COLOR',
      currentConfig.theme.surfaceColor
    ),
    textColor: readColor(profile, 'TEXT_COLOR', currentConfig.theme.textColor)
  }
})

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const currentConfig = await readRuntimeConfig(options.configPath)
  const runtimeConfig = createRuntimeConfig(currentConfig, options.profile)

  await writeFile(
    options.outPath,
    `${JSON.stringify(runtimeConfig, null, 2)}\n`
  )

  const profileLabel = options.profile === '' ? 'default' : options.profile
  console.info(
    `Generated passkey wallet runtime config for ${profileLabel}: ${options.outPath}`
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
