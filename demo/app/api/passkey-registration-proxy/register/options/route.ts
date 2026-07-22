import { forwardPasskeyRegistrationRequest } from '@/lib/passkey-registration-proxy'

export const POST = async (request: Request): Promise<Response> =>
  await forwardPasskeyRegistrationRequest({
    request,
    path: 'register/options'
  })
