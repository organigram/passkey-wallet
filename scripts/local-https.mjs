import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const packageDir = join(scriptDir, '..')
export const certificatesDir = join(packageDir, 'certificates')

const defaultCertificateHosts = [
  'localhost',
  '127.0.0.1',
  '::1',
  'local.organigram.ai'
]

const parseDotEnvLine = line => {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) return null

  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex < 0) return null

  const key = trimmed.slice(0, separatorIndex).trim()
  let value = trimmed.slice(separatorIndex + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return key === '' ? null : [key, value]
}

export const normalizeCertificateHosts = hosts =>
  Array.from(new Set(hosts)).sort((left, right) => left.localeCompare(right))

export const certificateMetadataMatchesConfig = (metadata, config) => {
  if (metadata == null || typeof metadata !== 'object') return false
  if (metadata.version !== 1 || !Array.isArray(metadata.hosts)) return false

  return (
    normalizeCertificateHosts(metadata.hosts).join('\n') ===
    normalizeCertificateHosts(config.certificateHosts).join('\n')
  )
}

export const loadLocalEnv = async () => {
  for (const fileName of ['.env', '.env.local']) {
    const filePath = join(packageDir, fileName)
    if (!existsSync(filePath)) continue

    const content = await readFile(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseDotEnvLine(line)
      if (parsed == null) continue

      const [key, value] = parsed
      process.env[key] ??= value
    }
  }
}

export const getLocalHttpsConfig = (profileOrHost = 'localhost') => {
  const requestedProfile = profileOrHost.trim() || 'localhost'
  const hostFromProfile =
    requestedProfile === 'local-organigram'
      ? 'local.organigram.ai'
      : requestedProfile
  const host = process.env.PASSKEY_WALLET_UI_HOST ?? hostFromProfile
  const listenHost = process.env.PASSKEY_WALLET_UI_LISTEN_HOST ?? '127.0.0.1'
  const sourcePort = Number(process.env.PASSKEY_WALLET_UI_HTTPS_PORT ?? 3002)
  const targetPort = Number(process.env.PASSKEY_WALLET_UI_VITE_PORT ?? 3003)
  const certificateName =
    process.env.PASSKEY_WALLET_UI_CERTIFICATE_NAME ?? 'local-passkey-wallet'
  const certificatePath = join(certificatesDir, `${certificateName}.pem`)
  const keyPath = join(certificatesDir, `${certificateName}-key.pem`)
  const metadataPath = join(certificatesDir, `${certificateName}.json`)
  const origin = `https://${host}:${sourcePort}`

  return {
    profile: requestedProfile,
    host,
    listenHost,
    sourcePort,
    targetPort,
    origin,
    certificatePath,
    keyPath,
    metadataPath,
    certificateHosts: Array.from(new Set([host, ...defaultCertificateHosts]))
  }
}

const runCommand = (
  command,
  args,
  { cwd = packageDir, env = process.env } = {}
) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit'
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${basename(command)} exited with code ${code ?? 1}.`))
    })
  })

export const ensureCertificate = async (config, { force = false } = {}) => {
  if (!force && existsSync(config.certificatePath) && existsSync(config.keyPath)) {
    const metadata = await readFile(config.metadataPath, 'utf8')
      .then(content => JSON.parse(content))
      .catch(() => null)
    if (certificateMetadataMatchesConfig(metadata, config)) return
  }

  await mkdir(certificatesDir, { recursive: true })

  try {
    await runCommand('mkcert', ['-install'])
    await runCommand('mkcert', [
      '-cert-file',
      config.certificatePath,
      '-key-file',
      config.keyPath,
      ...config.certificateHosts
    ])
    await writeFile(
      config.metadataPath,
      `${JSON.stringify(
        {
          version: 1,
          hosts: normalizeCertificateHosts(config.certificateHosts)
        },
        null,
        2
      )}\n`
    )
  } catch (error) {
    throw new Error(
      [
        'Unable to generate a trusted local HTTPS certificate with mkcert.',
        'Install mkcert first, then rerun the script.',
        'On macOS: brew install mkcert nss',
        '',
        error instanceof Error ? error.message : String(error)
      ].join('\n')
    )
  }
}
