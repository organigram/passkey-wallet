import { NextResponse } from 'next/server'

const passkeyWalletApiBasePath = '/api/auth/passkey'

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)

const normalizeHostname = (hostname: unknown): string =>
  typeof hostname === 'string'
    ? hostname.trim().replace(/^\./, '').toLowerCase()
    : ''

const inferPasskeyDomainFromHostname = (hostname: unknown): string => {
  const normalizedHostname = normalizeHostname(hostname)
  if (normalizedHostname === '' || isLocalHostname(normalizedHostname)) {
    return normalizedHostname
  }

  const labels = normalizedHostname.split('.').filter(Boolean)
  const localLabelIndex = labels.indexOf('local')
  if (localLabelIndex >= 0 && labels.length - localLabelIndex > 2) {
    return labels.slice(localLabelIndex + 1).join('.')
  }

  return labels.length <= 2 ? normalizedHostname : labels.slice(-2).join('.')
}

const isHostCompatibleWithDomain = ({
  hostname,
  domain
}: {
  hostname: string
  domain: string
}): boolean =>
  (isLocalHostname(hostname) && isLocalHostname(domain)) ||
  hostname === domain ||
  hostname.endsWith(`.${domain}`)

const getFirstHeaderValue = (
  headers: Headers,
  name: string
): string | null => {
  const value = headers.get(name)?.split(',')[0]?.trim()
  return value == null || value === '' ? null : value
}

const getForwardedOrigin = (request: Request): URL | null => {
  const forwardedHost = getFirstHeaderValue(request.headers, 'x-forwarded-host')
  if (forwardedHost == null) return null

  const forwardedProto =
    getFirstHeaderValue(request.headers, 'x-forwarded-proto') ?? 'https'

  return new URL(`${forwardedProto}://${forwardedHost}`)
}

const getRequestOrigin = (
  request: Request,
  clientOrigin?: string | null
): URL => {
  const originHeader = getFirstHeaderValue(request.headers, 'origin')
  const forwardedOrigin = getForwardedOrigin(request)
  const fallbackOrigin = new URL(request.url).origin
  const requestOrigin = new URL(
    originHeader ?? forwardedOrigin?.origin ?? fallbackOrigin
  )

  if (clientOrigin == null || clientOrigin === '') {
    return requestOrigin
  }

  const declaredOrigin = new URL(clientOrigin)
  if (originHeader != null && declaredOrigin.origin !== requestOrigin.origin) {
    throw new Error('Declared passkey origin does not match the request.')
  }

  return declaredOrigin
}

const getForwardedPayload = async (
  request: Request
): Promise<{
  targetBaseUrl: string
  clientOrigin: string | null
  payload: Record<string, unknown>
}> => {
  const body = (await request.json().catch(() => ({}))) as {
    targetBaseUrl?: unknown
    clientOrigin?: unknown
    payload?: unknown
  }
  if (typeof body.targetBaseUrl !== 'string' || body.targetBaseUrl === '') {
    throw new Error('A target passkey API base URL is required.')
  }
  if (typeof body.payload !== 'object' || body.payload == null) {
    throw new Error('A passkey API payload is required.')
  }

  return {
    targetBaseUrl: body.targetBaseUrl,
    clientOrigin:
      typeof body.clientOrigin === 'string' ? body.clientOrigin : null,
    payload: body.payload as Record<string, unknown>
  }
}

export const forwardPasskeyRegistrationRequest = async ({
  request,
  path
}: {
  request: Request
  path: 'register/options' | 'register/verify'
}): Promise<NextResponse> => {
  try {
    const { targetBaseUrl, clientOrigin, payload } =
      await getForwardedPayload(request)
    const requestOrigin = getRequestOrigin(request, clientOrigin)
    const targetBaseUrlObject = new URL(targetBaseUrl)
    const targetDomain = inferPasskeyDomainFromHostname(requestOrigin.hostname)

    if (targetBaseUrlObject.protocol !== 'https:') {
      throw new Error('The target passkey API must use HTTPS.')
    }
    if (
      !isHostCompatibleWithDomain({
        hostname: targetBaseUrlObject.hostname,
        domain: targetDomain
      })
    ) {
      throw new Error('The target passkey API host does not match this origin.')
    }
    if (!targetBaseUrlObject.pathname.endsWith(passkeyWalletApiBasePath)) {
      throw new Error('The target passkey API path is not allowed.')
    }

    const targetUrl = new URL(
      `${targetBaseUrlObject.pathname.replace(/\/+$/, '')}/${path}`,
      targetBaseUrlObject.origin
    )
    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: requestOrigin.origin
      },
      body: JSON.stringify(payload)
    }).catch(error => {
      throw new Error(
        `Unable to reach the target passkey API at ${targetUrl.origin}. ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    })
    const responseBody = (await upstreamResponse.json().catch(() => null)) as
      | Record<string, unknown>
      | null

    return NextResponse.json(responseBody ?? {}, {
      status: upstreamResponse.status
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    )
  }
}
