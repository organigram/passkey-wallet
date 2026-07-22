import {
  ensureCertificate,
  getLocalHttpsConfig,
  loadLocalEnv
} from './local-https.mjs'

await loadLocalEnv()

const config = getLocalHttpsConfig(process.argv[2])
await ensureCertificate(config, { force: true })

console.log(`Certificate ready for ${config.certificateHosts.join(', ')}`)
console.log(`  cert: ${config.certificatePath}`)
console.log(`  key:  ${config.keyPath}`)
