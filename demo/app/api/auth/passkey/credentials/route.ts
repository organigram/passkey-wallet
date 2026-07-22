import {
  handlePasskeyCredentialDelete,
  handlePasskeyCredentialsList
} from '@/lib/passkey-api'

export const GET = handlePasskeyCredentialsList
export const DELETE = handlePasskeyCredentialDelete
