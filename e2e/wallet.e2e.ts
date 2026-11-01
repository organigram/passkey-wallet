import { readFile } from 'node:fs/promises'
import { expect, test, type CDPSession, type Page } from 'playwright/test'

const recoveryPhrase =
  'test test test test test test test test test test test junk'
const localVaultsStorageKey = 'passkey-wallet.vaults.v1'

// A PRF-capable platform authenticator that approves every prompt.
const installAuthenticator = async (
  page: Page
): Promise<{ client: CDPSession; authenticatorId: string }> => {
  const client = await page.context().newCDPSession(page)
  await client.send('WebAuthn.enable')
  const { authenticatorId } = await client.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        hasPrf: true,
        automaticPresenceSimulation: true
      }
    }
  )

  return { client, authenticatorId }
}

const importSeedPhrase = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Import seed phrase' }).first().click()
  await page.getByLabel('Seed phrase').fill(recoveryPhrase)
  await page.getByRole('button', { name: 'Import existing account' }).click()
  await expect
    .poll(async () => await countLocalVaults(page), { timeout: 30_000 })
    .toBe(1)
}

const countLocalVaults = async (page: Page): Promise<number> =>
  await page.evaluate(key => {
    const raw = window.localStorage.getItem(key)
    return raw == null
      ? 0
      : (JSON.parse(raw) as { vaults: unknown[] }).vaults.length
  }, localVaultsStorageKey)

const revealSeedPhrase = async (page: Page): Promise<void> => {
  await page.goto('/settings#seed')
  await page.getByRole('button', { name: 'Reveal seed phrase' }).click()
  await expect(page.locator('.seed-word-card strong')).toHaveText(
    recoveryPhrase.split(' '),
    { timeout: 30_000 }
  )
}

test('unlocks an imported wallet with its passkey', async ({ page }) => {
  await installAuthenticator(page)
  await importSeedPhrase(page)
  await revealSeedPhrase(page)
})

test('restores a downloaded backup with another passkey of the wallet', async ({
  page
}) => {
  const { client, authenticatorId } = await installAuthenticator(page)
  page.on('dialog', dialog => {
    dialog.accept().catch(() => undefined)
  })
  await importSeedPhrase(page)
  const {
    credentials: [firstPasskey]
  } = await client.send('WebAuthn.getCredentials', { authenticatorId })

  await page.goto('/settings#passkeys')
  await page.getByRole('button', { name: 'Create new passkey' }).click()
  await page.getByRole('button', { name: 'Add new passkey' }).click()
  await expect.poll(async () => await countLocalVaults(page)).toBe(2)

  await page.goto('/settings#backup')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup' }).click()
  const backupJson = await readFile(
    (await (await downloadPromise).path()) as string,
    'utf8'
  )

  await client.send('WebAuthn.removeCredential', {
    authenticatorId,
    credentialId: firstPasskey.credentialId
  })
  await page.evaluate(key => {
    window.localStorage.removeItem(key)
  }, localVaultsStorageKey)
  await page.goto('/')
  await page.getByRole('button', { name: 'Restore backup' }).first().click()
  await page.getByLabel('Encrypted backup JSON').fill(backupJson)
  await page.getByRole('button', { name: 'Restore backup' }).last().click()
  await expect
    .poll(async () => await countLocalVaults(page), { timeout: 30_000 })
    .toBe(2)

  await revealSeedPhrase(page)
})

test('refuses a signing request whose origin is only declared in the URL', async ({
  page
}) => {
  const request = new URLSearchParams({
    type: 'organigram:wallet:send-transaction',
    version: '1',
    requestId: 'spoofed-request',
    appOrigin: 'https://organigram.ai',
    domain: 'organigram.ai',
    chainId: '1',
    requestedAt: new Date().toISOString(),
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    transaction: JSON.stringify({
      from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      to: '0x51E10ad4Eeb79e154bEe841FcBBAc83112122c7c',
      value: '0xde0b6b3a7640000'
    })
  })

  await page.goto(`/request?${request.toString()}`)

  await expect(
    page.getByText('Wallet requests must be delivered by postMessage.')
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Approve request/i })).toHaveCount(0)
})
