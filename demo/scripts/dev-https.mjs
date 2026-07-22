import { createServer } from 'node:https'
import { request as httpRequest } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import {
  ensureCertificate,
  exampleDir,
  getLocalHttpsConfig,
  loadLocalEnv
} from './local-https.mjs'

await loadLocalEnv()

const config = getLocalHttpsConfig(process.argv[2])
await ensureCertificate(config)

const nextBinary = join(
  exampleDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'next.cmd' : 'next'
)
const nextEnv = {
  ...process.env,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? config.origin,
  NEXTAUTH_SECRET:
    process.env.NEXTAUTH_SECRET ?? 'passkey-wallet-demo-local-secret',
  PASSKEY_WALLET_RP_NAME:
    process.env.PASSKEY_WALLET_RP_NAME ?? 'Passkey Wallet Example'
}
const nextProcess = spawn(
  nextBinary,
  ['dev', '--hostname', '127.0.0.1', '--port', String(config.targetPort)],
  {
    cwd: exampleDir,
    env: nextEnv,
    stdio: 'inherit'
  }
)

nextProcess.on('exit', code => {
  if (code !== 0 && code != null) {
    process.exitCode = code
  }
  server.close()
})

const proxyRequest = (clientRequest, clientResponse) => {
  const headers = {
    ...clientRequest.headers,
    host: `${config.host}:${config.sourcePort}`,
    'x-forwarded-host': `${config.host}:${config.sourcePort}`,
    'x-forwarded-proto': 'https'
  }

  const upstreamRequest = httpRequest(
    {
      hostname: '127.0.0.1',
      port: config.targetPort,
      path: clientRequest.url,
      method: clientRequest.method,
      headers
    },
    upstreamResponse => {
      clientResponse.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers
      )
      upstreamResponse.pipe(clientResponse)
    }
  )

  upstreamRequest.on('error', error => {
    clientResponse.writeHead(502, { 'Content-Type': 'text/plain' })
    clientResponse.end(`Next dev server is not reachable yet.\n${error.message}`)
  })

  clientRequest.pipe(upstreamRequest)
}

const server = createServer(
  {
    cert: readFileSync(config.certificatePath),
    key: readFileSync(config.keyPath)
  },
  proxyRequest
)

server.on('upgrade', (clientRequest, clientSocket, head) => {
  const upstreamRequest = httpRequest({
    hostname: '127.0.0.1',
    port: config.targetPort,
    path: clientRequest.url,
    method: clientRequest.method,
    headers: {
      ...clientRequest.headers,
      host: `${config.host}:${config.sourcePort}`,
      'x-forwarded-host': `${config.host}:${config.sourcePort}`,
      'x-forwarded-proto': 'https'
    }
  })

  upstreamRequest.on('upgrade', (upstreamResponse, upstreamSocket) => {
    clientSocket.write(
      [
        `HTTP/${upstreamResponse.httpVersion} ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage}`,
        ...Object.entries(upstreamResponse.headers).flatMap(([key, value]) =>
          Array.isArray(value)
            ? value.map(item => `${key}: ${item}`)
            : value == null
              ? []
              : [`${key}: ${value}`]
        ),
        '',
        ''
      ].join('\r\n')
    )
    upstreamSocket.write(head)
    upstreamSocket.pipe(clientSocket)
    clientSocket.pipe(upstreamSocket)
  })

  upstreamRequest.on('error', () => {
    clientSocket.destroy()
  })
  upstreamRequest.end()
})

server.listen(config.sourcePort, config.listenHost, () => {
  console.log('')
  console.log(`Passkey Wallet demo ready at ${config.origin}`)
  console.log(`HTTPS proxy listen host: ${config.listenHost}`)
  console.log(`Next dev target: http://127.0.0.1:${config.targetPort}`)
  console.log(`NEXTAUTH_URL: ${nextEnv.NEXTAUTH_URL}`)
  console.log('')
})

const stop = () => {
  nextProcess.kill()
  server.close(() => {
    process.exit()
  })
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
