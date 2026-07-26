import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDir, '..')
const rainbowKitEntry = await import.meta.resolve('@rainbow-me/rainbowkit')
const rainbowKitDist = dirname(fileURLToPath(rainbowKitEntry))
const entries = []
const toDataUri = svg =>
  `data:image/svg+xml,${encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')}`

const manualNetworkIcons = {
  fantom:
    toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none">
  <rect width="28" height="28" rx="14" fill="#1969FF"/>
  <path fill="#fff" d="M14 4.8 7.6 8.5v11L14 23.2l6.4-3.7v-11L14 4.8Zm4.4 5.4-3.4 2v-3.9l3.4 1.9Zm-4.4-3 3.6 2.1-3.6 2.1-3.6-2.1L14 7.2Zm-4.4 3 3.4-1.9v3.9l-3.4-2Zm0 2.3 3.4 2v4l-3.4-2v-4Zm4.4 8.3-3.6-2.1 3.6-2.1 3.6 2.1-3.6 2.1Zm4.4-4.3-3.4 2v-4l3.4-2v4Z"/>
</svg>`),
  mode: toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none">
  <rect width="28" height="28" rx="14" fill="#DFFE00"/>
  <path fill="#111" d="M6.2 8.2h3.2l4.6 6.2 4.6-6.2h3.2v11.6h-3.4v-6.2l-3.2 4.3h-2.4l-3.2-4.3v6.2H6.2V8.2Z"/>
</svg>`),
  moonbeam:
    toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none">
  <rect width="28" height="28" rx="14" fill="#53CBC8"/>
  <path fill="#F6E14D" d="M17.7 5.5a8.6 8.6 0 1 0 4.8 13.7 7.1 7.1 0 1 1-4.8-13.7Z"/>
  <path fill="#7B3FF2" d="M6.9 19.7c2.1 2.8 6 3.8 9.2 2.3 1.8-.8 3.3-2.3 4.1-4.1-1.8 1-4 1.1-6 .2-2.7-1.2-4.5-3.9-4.4-6.9-2.8 1.8-4.4 5.7-2.9 8.5Z"/>
  <circle cx="18.4" cy="9.7" r="2.2" fill="#fff"/>
</svg>`),
  opbnb:
    toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none">
  <rect width="28" height="28" rx="14" fill="#F0B90B"/>
  <path fill="#fff" d="m14 5.2 3.2 3.2-1.9 1.9L14 9l-1.3 1.3-1.9-1.9L14 5.2Zm-5.6 5.6 1.9 1.9L9 14l1.3 1.3-1.9 1.9L5.2 14l3.2-3.2Zm11.2 0 3.2 3.2-3.2 3.2-1.9-1.9L19 14l-1.3-1.3 1.9-1.9ZM14 19l1.3-1.3 1.9 1.9-3.2 3.2-3.2-3.2 1.9-1.9L14 19Zm0-6.8 1.8 1.8-1.8 1.8-1.8-1.8 1.8-1.8Z"/>
  <path fill="#111" d="M5.9 20.5h6.7v1.8H5.9v-1.8Zm9.1 0h7.1v1.8H15v-1.8Z"/>
</svg>`)
}

for (const file of readdirSync(rainbowKitDist)) {
  if (!file.endsWith('.js')) continue

  const source = readFileSync(resolve(rainbowKitDist, file), 'utf8')
  const match = source.match(
    /chainIcons\/([^./]+)\.svg[\s\S]*?var \w+ = "([^"]+)";/
  )
  if (match == null) continue

  entries.push({
    key: match[1],
    url: match[2]
  })
}

const existingKeys = new Set(entries.map(entry => entry.key))
for (const [key, url] of Object.entries(manualNetworkIcons)) {
  if (existingKeys.has(key)) continue
  entries.push({ key, url })
}

entries.sort((left, right) => left.key.localeCompare(right.key))

const output = `// Generated from @rainbow-me/rainbowkit chain icon chunks and local fallbacks.
// Run scripts/generate-rainbowkit-network-icons.mjs after upgrading RainbowKit.

export const rainbowKitNetworkIconUrls: Record<string, string> = {
${entries
  .map(
    entry =>
      `  ${JSON.stringify(entry.key).replaceAll('"', '')}: ${JSON.stringify(entry.url)}`
  )
  .join(',\n')
  .replaceAll('"', "'")}
}

const rainbowKitNetworkIconAliases: Record<string, string> = {
  arbitrumone: 'arbitrum',
  arbitrumsepolia: 'arbitrum',
  avalanchecchain: 'avalanche',
  avalanchefuji: 'avalanche',
  basesepolia: 'base',
  binance: 'bsc',
  binancesmartchain: 'bsc',
  bnb: 'bsc',
  bnbchain: 'bsc',
  bnbsmartchain: 'bsc',
  bnbsmartchaintestnet: 'bsc',
  bsctestnet: 'bsc',
  celoalfajores: 'celo',
  celosepolia: 'celo',
  ethereum: 'ethereum',
  ethereummainnet: 'ethereum',
  fantomsonictestnet: 'fantom',
  fantomopera: 'fantom',
  fantomtestnet: 'fantom',
  gnosis: 'gnosis',
  gnosischiado: 'gnosis',
  gnosischain: 'gnosis',
  hardhat: 'hardhat',
  holesky: 'ethereum',
  lineasepolia: 'linea',
  local: 'hardhat',
  localanvil: 'hardhat',
  mainnet: 'ethereum',
  mantlesepolia: 'mantle',
  mantlesepoliatestnet: 'mantle',
  modetestnet: 'mode',
  moonbasealpha: 'moonbeam',
  optimismsepolia: 'optimism',
  opbnbtestnet: 'opbnb',
  polygonamoy: 'polygon',
  polygonmainnet: 'polygon',
  polygonpos: 'polygon',
  scrollsepolia: 'scroll',
  sepolia: 'ethereum',
  sonictestnet: 'fantom',
  zksyncera: 'zksync'
}

const normalizeNetworkIconKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

export const resolveRainbowKitNetworkIconUrl = (
  ...values: Array<string | null | undefined>
): string | null => {
  for (const value of values) {
    if (value == null || value.trim() === '') continue

    const directKey = value.toLowerCase()
    if (rainbowKitNetworkIconUrls[directKey] != null) {
      return rainbowKitNetworkIconUrls[directKey]
    }

    const normalizedKey = normalizeNetworkIconKey(value)
    const aliasedKey = rainbowKitNetworkIconAliases[normalizedKey] ?? normalizedKey
    if (rainbowKitNetworkIconUrls[aliasedKey] != null) {
      return rainbowKitNetworkIconUrls[aliasedKey]
    }
  }

  return null
}
`

writeFileSync(
  resolve(packageRoot, 'ui/helpers/rainbowkitNetworkIcons.ts'),
  output
)
