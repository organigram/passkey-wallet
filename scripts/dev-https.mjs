import { createServer } from 'node:https'
import { request as httpRequest } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import {
  ensureCertificate,
  getLocalHttpsConfig,
  loadLocalEnv,
  packageDir
} from './local-https.mjs'

await loadLocalEnv()

const config = getLocalHttpsConfig(process.argv[2])
await ensureCertificate(config)

const viteBinary = join(
  packageDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
)
const viteProcess = spawn(
  viteBinary,
  [
    '--force',
    '--host',
    '127.0.0.1',
    '--port',
    String(config.targetPort)
  ],
  {
    cwd: packageDir,
    env: process.env,
    stdio: 'inherit'
  }
)

const proxyRequest = (clientRequest, clientResponse) => {
  const upstreamRequest = httpRequest(
    {
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
    clientResponse.end(`Vite dev server is not reachable yet.\n${error.message}`)
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

viteProcess.on('exit', code => {
  if (code !== 0 && code != null) {
    process.exitCode = code
  }
  server.close()
})

server.listen(config.sourcePort, config.listenHost, () => {
  console.info('')
  console.info(`Organigram Passkey Wallet UI ready at ${config.origin}`)
  console.info(`HTTPS proxy listen host: ${config.listenHost}`)
  console.info(`Vite target: http://127.0.0.1:${config.targetPort}`)
  console.info('')
})

const stop = () => {
  viteProcess.kill()
  server.close(() => {
    process.exit()
  })
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
