import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

// The public repository only receives this package, without the monorepo
// lockfile. This script derives a standalone pnpm lockfile from the workspace
// lockfile, so that the public sources install the exact versions that build
// the deployed wallet. Root overrides and the patches they need are mirrored
// in package.json, which pnpm requires for a frozen install of this lockfile
// (and ignores, with a warning, inside the monorepo).
//
// Usage: node scripts/generate-standalone-lockfile.mjs [--check]

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageDir = join(scriptDir, '..')
const workspaceDir = join(packageDir, '..', '..')
const importerPath = 'packages/passkey-wallet'
const isCheck = process.argv.includes('--check')

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const sortKeys = object =>
  Object.fromEntries(
    Object.entries(object).sort(([left], [right]) => left.localeCompare(right))
  )

// Aliased dependencies record the target package instead of a version.
const toSnapshotKey = (name, version) =>
  version.startsWith('link:')
    ? null
    : /^(@[^/@()]+\/)?[^@()]+@/.test(version)
      ? version
      : `${name}@${version}`

// Snapshot keys append peer dependencies in parentheses; package keys do not.
const toPackageKey = snapshotKey => {
  const peerIndex = snapshotKey.indexOf('(')
  return peerIndex === -1 ? snapshotKey : snapshotKey.slice(0, peerIndex)
}

const workspaceLockfile = YAML.parse(
  readFileSync(join(workspaceDir, 'pnpm-lock.yaml'), 'utf8')
)
const importer = workspaceLockfile.importers[importerPath]
if (importer == null) {
  throw new Error(`${importerPath} is missing from the workspace lockfile.`)
}

const snapshots = {}
const packages = {}
const pending = []
for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, { version }] of Object.entries(importer[group] ?? {})) {
    const key = toSnapshotKey(name, version)
    if (key == null) {
      throw new Error(`Workspace links cannot be published: ${name}`)
    }
    pending.push(key)
  }
}
while (pending.length > 0) {
  const key = pending.pop()
  if (snapshots[key] != null) continue

  const snapshot = workspaceLockfile.snapshots[key]
  if (snapshot == null) throw new Error(`Missing lockfile snapshot: ${key}`)
  snapshots[key] = snapshot
  packages[toPackageKey(key)] = workspaceLockfile.packages[toPackageKey(key)]
  for (const group of ['dependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(snapshot[group] ?? {})) {
      const child = toSnapshotKey(name, version)
      if (child != null) pending.push(child)
    }
  }
}

const workspacePnpmConfig = readJson(join(workspaceDir, 'package.json')).pnpm ?? {}
const overrides = workspaceLockfile.overrides ?? {}
const patchedDependencies = Object.fromEntries(
  Object.entries(workspacePnpmConfig.patchedDependencies ?? {}).filter(
    ([name]) => packages[name] != null
  )
)
const lockfilePatches = Object.fromEntries(
  Object.entries(workspaceLockfile.patchedDependencies ?? {}).filter(
    ([name]) => packages[name] != null
  )
)

const expectedLockfile = YAML.stringify(
  {
    lockfileVersion: workspaceLockfile.lockfileVersion,
    settings: workspaceLockfile.settings,
    ...(Object.keys(overrides).length === 0 ? {} : { overrides }),
    ...(Object.keys(lockfilePatches).length === 0
      ? {}
      : { patchedDependencies: lockfilePatches }),
    importers: { '.': importer },
    packages: sortKeys(packages),
    snapshots: sortKeys(snapshots)
  },
  { lineWidth: 0 }
)

const packageJsonPath = join(packageDir, 'package.json')
const packageJson = readJson(packageJsonPath)
const expectedPackageJson = `${JSON.stringify(
  {
    ...packageJson,
    pnpm: {
      ...(Object.keys(overrides).length === 0 ? {} : { overrides }),
      ...(Object.keys(patchedDependencies).length === 0
        ? {}
        : { patchedDependencies })
    }
  },
  null,
  2
)}\n`

const outputs = [
  [join(packageDir, 'pnpm-lock.yaml'), expectedLockfile],
  [packageJsonPath, expectedPackageJson],
  ...Object.values(patchedDependencies).map(patchPath => [
    join(packageDir, patchPath),
    readFileSync(join(workspaceDir, patchPath), 'utf8')
  ])
]

if (isCheck) {
  const stale = outputs.filter(
    ([path, content]) =>
      !existsSync(path) || readFileSync(path, 'utf8') !== content
  )
  if (stale.length > 0) {
    for (const [path] of stale) console.error(`Out of date: ${path}`)
    console.error(
      'Run `pnpm passkey-wallet lockfile` and commit the result.'
    )
    process.exitCode = 1
  } else {
    console.info('Standalone lockfile matches the workspace lockfile.')
  }
} else {
  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  console.info(
    `Wrote pnpm-lock.yaml (${Object.keys(packages).length} packages) and synced package.json.`
  )
}
