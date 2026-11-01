import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const parseArgs = args => {
  const options = {
    distDir: 'app-dist',
    manifestPath: '',
    url: ''
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--dist') {
      if (next == null) throw new Error('--dist requires a path.')
      options.distDir = next
      index += 1
      continue
    }
    if (arg === '--url') {
      if (next == null) throw new Error('--url requires a wallet URL.')
      options.url = next
      index += 1
      continue
    }
    if (arg === '--manifest') {
      if (next == null) throw new Error('--manifest requires a path.')
      options.manifestPath = next
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (options.manifestPath === '' && options.url === '') {
    throw new Error('--manifest is required unless --url is given.')
  }

  return options
}

const sha256 = value => createHash('sha256').update(value).digest('hex')
const toPosixPath = path => path.split(sep).join('/')

const collectFiles = async directory => {
  const files = []

  const visit = async currentDirectory => {
    const entries = await readdir(currentDirectory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue

      const path = join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile()) continue

      const content = await readFile(path)
      files.push({
        path: toPosixPath(relative(directory, path)),
        sha256: sha256(content),
        byteLength: content.byteLength
      })
    }
  }

  await visit(directory)
  return files
}

// Release manifests are published on the public repository, independently of
// the host serving the wallet.
const releasesUrl =
  'https://api.github.com/repos/organigram/passkey-wallet/releases?per_page=30'

const fetchBytes = async (url, redirect = 'follow') => {
  const response = await fetch(url, { cache: 'no-store', redirect })
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}.`)
  }

  return Buffer.from(await response.arrayBuffer())
}

// Selects the published release whose index.html is the one being served.
// index.html loads every other code file, so it identifies the release.
const findReleaseManifest = async indexSha256 => {
  const response = await fetch(releasesUrl, {
    headers: { accept: 'application/vnd.github+json' }
  })
  if (!response.ok) {
    throw new Error(`Unable to list releases (${response.status}).`)
  }

  for (const release of await response.json()) {
    for (const asset of release.assets ?? []) {
      if (!asset.name.endsWith('.manifest.json')) continue

      const manifest = JSON.parse(
        (await fetchBytes(asset.browser_download_url)).toString('utf8')
      )
      if (
        manifest.files?.some(
          file => file.path === 'index.html' && file.sha256 === indexSha256
        )
      ) {
        return { manifest, releaseUrl: release.html_url }
      }
    }
  }

  throw new Error('No published release matches the served index.html.')
}

// Every file of the release must be served unchanged, the runtime config
// included: it sets the passkey RP ID, the Stack origin and the RPC URLs.
const verifyDeployment = async options => {
  const origin = new URL(options.url).origin
  const failures = []
  const fetchServed = async path =>
    await fetchBytes(new URL(path, origin), 'error')
  const indexSha256 = sha256(await fetchServed('/'))
  for (const route of ['/index.html', '/request', '/settings']) {
    if (sha256(await fetchServed(route)) !== indexSha256) {
      failures.push(`${route} does not serve the same index.html as /`)
    }
  }

  const { manifest, releaseUrl } =
    options.manifestPath === ''
      ? await findReleaseManifest(indexSha256)
      : {
          manifest: JSON.parse(await readFile(options.manifestPath, 'utf8')),
          releaseUrl: options.manifestPath
        }

  for (const file of manifest.files) {
    const served = await fetchServed(`/${file.path}`).catch(() => null)
    if (served == null) {
      failures.push(`Missing release file: ${file.path}`)
    } else if (sha256(served) !== file.sha256) {
      failures.push(`Hash mismatch: ${file.path}`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`)
    process.exitCode = 1
    return
  }

  console.info(
    `${origin} serves release ${manifest.name} v${manifest.version} unchanged (${manifest.files.length} file(s)).`
  )
  console.info(`Reference: ${releaseUrl}`)
}

const isCodePath = path =>
  path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.url !== '') {
    await verifyDeployment(options)
    return
  }
  const manifest = JSON.parse(await readFile(options.manifestPath, 'utf8'))
  const customizablePaths = new Set(manifest.customizableRuntimePaths ?? [])
  const expectedFiles = new Map(
    manifest.files
      .filter(file => !customizablePaths.has(file.path))
      .map(file => [file.path, file])
  )
  const actualFiles = await collectFiles(options.distDir)
  const actualFilesByPath = new Map(actualFiles.map(file => [file.path, file]))
  const failures = []
  const warnings = []

  for (const [path, expectedFile] of expectedFiles) {
    const actualFile = actualFilesByPath.get(path)
    if (actualFile == null) {
      failures.push(`Missing release file: ${path}`)
      continue
    }
    if (actualFile.sha256 !== expectedFile.sha256) {
      failures.push(`Hash mismatch: ${path}`)
    }
  }

  for (const actualFile of actualFiles) {
    if (expectedFiles.has(actualFile.path) || customizablePaths.has(actualFile.path)) {
      continue
    }
    if (isCodePath(actualFile.path)) {
      failures.push(`Unexpected code file: ${actualFile.path}`)
      continue
    }
    warnings.push(`Extra runtime asset: ${actualFile.path}`)
  }

  const configPath = join(options.distDir, 'passkey-wallet.config.json')
  if (existsSync(configPath)) {
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    if (config.version !== 1) {
      failures.push('Unsupported runtime config version.')
    }
    for (const field of ['title', 'subtitle', 'githubUrl', 'verifyUrl']) {
      if (Object.hasOwn(config, field)) {
        failures.push(`Runtime config must not override immutable field: ${field}`)
      }
    }
  } else {
    warnings.push('No runtime config file found.')
  }

  for (const warning of warnings) console.warn(`WARN ${warning}`)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`)
    process.exitCode = 1
    return
  }

  console.info(`Verified ${expectedFiles.size} release file(s).`)
  console.info(
    `Ignored ${customizablePaths.size} customizable runtime path(s): ${[
      ...customizablePaths
    ].join(', ')}`
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
