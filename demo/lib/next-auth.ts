import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getAddress, verifyMessage } from 'viem'
import { parseSiweMessage } from 'viem/siwe'

const parseCookies = (cookieHeader: string | null): Record<string, string> =>
  Object.fromEntries(
    (cookieHeader ?? '')
      .split(';')
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const separatorIndex = cookie.indexOf('=')
        if (separatorIndex < 0) return [cookie, '']

        return [
          cookie.slice(0, separatorIndex),
          decodeURIComponent(cookie.slice(separatorIndex + 1))
        ]
      })
  )

type RequestHeaders = Headers | Record<string, unknown> | undefined

const getHeader = (headers: RequestHeaders, name: string): string | null => {
  if (headers == null) return null
  if (headers instanceof Headers) {
    const value = headers.get(name)
    return value == null || value === '' ? null : value
  }

  const value = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  )?.[1]
  if (Array.isArray(value)) {
    const firstValue = value[0]
    return typeof firstValue === 'string' && firstValue !== ''
      ? firstValue
      : null
  }

  return typeof value === 'string' && value !== '' ? value : null
}

const getRequestHost = (headers: RequestHeaders): string => {
  const forwardedHost = getHeader(headers, 'x-forwarded-host')
  if (forwardedHost != null && forwardedHost !== '') {
    return forwardedHost.split(',')[0]!.trim()
  }

  return getHeader(headers, 'host') ?? 'localhost:3000'
}

const getCsrfToken = ({
  credentials,
  headers
}: {
  credentials: Record<string, unknown> | undefined
  headers: RequestHeaders
}): string | null => {
  const credentialToken = credentials?.csrfToken
  if (typeof credentialToken === 'string' && credentialToken !== '') {
    return credentialToken
  }

  const cookies = parseCookies(getHeader(headers, 'cookie'))
  const csrfCookie =
    cookies['__Host-next-auth.csrf-token'] ??
    cookies['__Secure-next-auth.csrf-token'] ??
    cookies['next-auth.csrf-token']

  return csrfCookie == null || csrfCookie === ''
    ? null
    : (csrfCookie.split('|')[0] ?? null)
}

export const authOptions = (): NextAuthOptions => ({
  providers: [
    CredentialsProvider({
      name: 'Ethereum',
      credentials: {
        message: { label: 'SIWE message', type: 'text' },
        signature: { label: 'Signature', type: 'text' }
      },
      async authorize(credentials, request) {
        const message = credentials?.message
        const signature = credentials?.signature
        const nonce = getCsrfToken({
          credentials: credentials as Record<string, unknown> | undefined,
          headers: request.headers
        })

        if (typeof message !== 'string' || message === '') return null
        if (typeof signature !== 'string' || !signature.startsWith('0x')) {
          return null
        }
        if (nonce == null || nonce === '') return null

        const siwe = parseSiweMessage(message)
        if (
          siwe.address == null ||
          siwe.domain == null ||
          siwe.nonce == null ||
          siwe.version !== '1'
        ) {
          return null
        }
        if (siwe.domain !== getRequestHost(request.headers)) return null
        if (siwe.nonce !== nonce) return null

        const address = getAddress(siwe.address as `0x${string}`)
        const isValid = await verifyMessage({
          address,
          message,
          signature: signature as `0x${string}`
        })
        if (!isValid) return null

        return {
          id: address,
          name: address
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user != null) {
        token.sub = user.id
        token.name = user.name
      }

      return token
    },
    session({ session, token }) {
      if (session.user != null && typeof token.sub === 'string') {
        session.user.name = token.sub
      }

      return session
    }
  },
  secret:
    process.env.NEXTAUTH_SECRET ??
    'passkey-wallet-demo-local-secret'
})
