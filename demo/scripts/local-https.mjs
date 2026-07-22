import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const exampleDir = join(scriptDir, '..')
export const certificatesDir = join(exampleDir, 'certificates')

const defaultCertificateHosts = [
  'localhost',
  '127.0.0.1',
  '::1',
  'local.organigram.ai'
]

const parseDotEnvLine = (line) => {
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

export const loadLocalEnv = async () => {
  const { readFile } = await import('node:fs/promises')
  for (const fileName of ['.env', '.env.local']) {
    const filePath = join(exampleDir, fileName)
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
  const host = process.env.PASSKEY_WALLET_DEMO_HOST ?? hostFromProfile
  const listenHost = process.env.PASSKEY_WALLET_DEMO_LISTEN_HOST ?? '127.0.0.1'
  const sourcePort = Number(process.env.PASSKEY_WALLET_DEMO_HTTPS_PORT ?? 3000)
  const targetPort = Number(process.env.PASSKEY_WALLET_DEMO_NEXT_PORT ?? 3001)
  const certificateName =
    process.env.PASSKEY_WALLET_DEMO_CERTIFICATE_NAME ?? 'local-passkey-wallet'
  const certificatePath = join(certificatesDir, `${certificateName}.pem`)
  const keyPath = join(certificatesDir, `${certificateName}-key.pem`)
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
    certificateHosts: Array.from(new Set([host, ...defaultCertificateHosts]))
  }
}

const runCommand = (command, args, { cwd = exampleDir, env = process.env } = {}) =>
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
  if (
    !force &&
    existsSync(config.certificatePath) &&
    existsSync(config.keyPath)
  ) {
    return
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
