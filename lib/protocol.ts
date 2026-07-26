export const normalizeHost = (domain: string): string =>
  domain.trim().toLowerCase().replace(/\.$/, '')

export const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Organigram wallet ${field} is required.`)
  }

  return value.trim()
}
