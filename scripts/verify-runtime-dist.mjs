import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const parseArgs = args => {
  const options = {
    distDir: 'app-dist',
    manifestPath: ''
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
    if (arg === '--manifest') {
      if (next == null) throw new Error('--manifest requires a path.')
      options.manifestPath = next
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (options.manifestPath === '') {
    throw new Error('--manifest is required.')
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

const isCodePath = path =>
  path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
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
    for (const field of ['title', 'subtitle', 'githubUrl']) {
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

  console.log(`Verified ${expectedFiles.size} release file(s).`)
  console.log(
    `Ignored ${customizablePaths.size} customizable runtime path(s): ${[
      ...customizablePaths
    ].join(', ')}`
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
