import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageDir = join(scriptDir, '..')
const packageJsonPath = join(packageDir, 'package.json')

const defaultIgnoredFileNames = new Set(['.DS_Store'])
const defaultCustomizableRuntimePaths = [
  'passkey-wallet.config.json',
  'png/logo-gradient.png',
  'transparent-glass.jpg'
]
const tarBlockSize = 512
const defaultSourceDateEpoch = 1704067200

const parseArgs = args => {
  const options = {
    distDir: join(packageDir, 'app-dist'),
    outDir: join(packageDir, 'artifacts'),
    name: 'passkey-wallet-app',
    version: null,
    sourceDateEpoch: Number(
      process.env.SOURCE_DATE_EPOCH ?? defaultSourceDateEpoch
    )
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
    if (arg === '--out-dir') {
      if (next == null) throw new Error('--out-dir requires a path.')
      options.outDir = next
      index += 1
      continue
    }
    if (arg === '--name') {
      if (next == null) throw new Error('--name requires a value.')
      options.name = next
      index += 1
      continue
    }
    if (arg === '--version') {
      if (next == null) throw new Error('--version requires a value.')
      options.version = next
      index += 1
      continue
    }
    if (arg === '--source-date-epoch') {
      if (next == null) {
        throw new Error('--source-date-epoch requires a unix timestamp.')
      }
      options.sourceDateEpoch = Number(next)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isInteger(options.sourceDateEpoch) || options.sourceDateEpoch < 0) {
    throw new Error('sourceDateEpoch must be a positive unix timestamp.')
  }

  return options
}

const sha256 = value => createHash('sha256').update(value).digest('hex')

const loadPackageVersion = async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  if (typeof packageJson.version !== 'string' || packageJson.version === '') {
    throw new Error('Unable to resolve package version from package.json.')
  }

  return packageJson.version
}

const toPosixPath = path => path.split(sep).join('/')

const collectFiles = async directory => {
  const files = []

  const visit = async currentDirectory => {
    const entries = await readdir(currentDirectory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      if (defaultIgnoredFileNames.has(entry.name)) continue

      const path = join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile()) continue

      const content = await readFile(path)
      files.push({
        absolutePath: path,
        relativePath: toPosixPath(relative(directory, path)),
        content,
        size: content.byteLength
      })
    }
  }

  await visit(directory)
  return files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  )
}

const writeString = (header, offset, length, value) => {
  const bytes = Buffer.from(value)
  if (bytes.byteLength > length) {
    throw new Error(`Tar field is too long: ${value}`)
  }
  bytes.copy(header, offset)
}

const writeOctal = (header, offset, length, value) => {
  const octal = value.toString(8)
  if (octal.length > length - 1) {
    throw new Error(`Tar numeric field is too large: ${value}`)
  }
  writeString(header, offset, length, octal.padStart(length - 1, '0'))
}

const createTarHeader = ({ relativePath, size, mtime }) => {
  const header = Buffer.alloc(tarBlockSize)
  const pathBytes = Buffer.from(relativePath)
  if (pathBytes.byteLength > 100) {
    throw new Error(
      `Tar path is longer than the supported ustar name field: ${relativePath}`
    )
  }

  writeString(header, 0, 100, relativePath)
  writeOctal(header, 100, 8, 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, mtime)
  header.fill(0x20, 148, 156)
  writeString(header, 156, 1, '0')
  writeString(header, 257, 6, 'ustar')
  writeString(header, 263, 2, '00')
  writeString(header, 265, 32, 'root')
  writeString(header, 297, 32, 'root')

  let checksum = 0
  for (const byte of header) checksum += byte
  writeOctal(header, 148, 8, checksum)
  header[155] = 0x20

  return header
}

const padToTarBlock = length => {
  const remainder = length % tarBlockSize
  return remainder === 0 ? 0 : tarBlockSize - remainder
}

const createTar = (files, { sourceDateEpoch }) => {
  const chunks = []
  for (const file of files) {
    chunks.push(
      createTarHeader({
        relativePath: file.relativePath,
        size: file.content.byteLength,
        mtime: sourceDateEpoch
      }),
      file.content
    )

    const padding = padToTarBlock(file.content.byteLength)
    if (padding > 0) chunks.push(Buffer.alloc(padding))
  }

  chunks.push(Buffer.alloc(tarBlockSize * 2))
  return Buffer.concat(chunks)
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const distStats = existsSync(options.distDir)
    ? await stat(options.distDir)
    : null
  if (distStats == null || !distStats.isDirectory()) {
    throw new Error(
      `UI dist directory does not exist: ${options.distDir}. Run pnpm build first.`
    )
  }

  const version = options.version ?? (await loadPackageVersion())
  const artifactBaseName = `${options.name}-v${version}`
  const archivePath = join(options.outDir, `${artifactBaseName}.tar.gz`)
  const checksumPath = join(options.outDir, `${artifactBaseName}.sha256`)
  const manifestPath = join(options.outDir, `${artifactBaseName}.manifest.json`)
  const files = await collectFiles(options.distDir)
  const tar = createTar(files, {
    sourceDateEpoch: options.sourceDateEpoch
  })
  const archive = gzipSync(tar, {
    level: 9,
    mtime: options.sourceDateEpoch
  })
  const archiveSha256 = sha256(archive)

  await mkdir(options.outDir, { recursive: true })
  await writeFile(archivePath, archive)
  await writeFile(
    checksumPath,
    `${archiveSha256}  ${basename(archivePath)}\n`
  )
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        name: options.name,
        version,
        archive: basename(archivePath),
        sha256: archiveSha256,
        byteLength: archive.byteLength,
        sourceDateEpoch: options.sourceDateEpoch,
        customizableRuntimePaths: defaultCustomizableRuntimePaths,
        files: files.map(file => ({
          path: file.relativePath,
          byteLength: file.size,
          sha256: sha256(file.content)
        }))
      },
      null,
      2
    )}\n`
  )

  console.info(`Created ${archivePath}`)
  console.info(`SHA-256 ${archiveSha256}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
