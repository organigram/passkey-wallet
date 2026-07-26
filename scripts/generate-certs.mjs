import {
  ensureCertificate,
  getLocalHttpsConfig,
  loadLocalEnv
} from './local-https.mjs'

await loadLocalEnv()
await ensureCertificate(getLocalHttpsConfig(process.argv[2]), { force: true })
