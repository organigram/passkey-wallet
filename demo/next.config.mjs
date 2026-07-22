import { fileURLToPath } from 'node:url'

const organigramJsShim = fileURLToPath(
  new URL('./lib/organigram-js-shim.ts', import.meta.url)
)

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'local.organigram.ai'],
  transpilePackages: ['@organigram/passkey-wallet'],
  webpack: config => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@organigram/js': organigramJsShim
    }

    return config
  },
  turbopack: {
    resolveAlias: {
      '@organigram/js': './lib/organigram-js-shim.ts'
    }
  }
}

export default nextConfig
