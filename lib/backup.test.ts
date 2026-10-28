import {
  createRemoteVaultBackupPackage,
  createRemoteVaultBackupRecord,
  decryptRemoteVaultBackupRecord,
  parseRemoteVaultBackupPackage
} from './backup'
import {
  derivePasskeyVaultKey,
  encryptPasskeyVaultSecret
} from './crypto'
import type { StoredVaultRecord } from './localVault'

describe('remote vault backups', () => {
  const address = '0x41e699cCBe26b375FB5d926ef90873cde1787BEF' as const
  const recoveryPhrase =
    'test test test test test test test test test test test junk'
  const createRecord = async (
    credentialId: string
  ): Promise<StoredVaultRecord> => {
    const salt = new Uint8Array(32).fill(2)
    return {
      credentialId,
      envelope: await encryptPasskeyVaultSecret({
        plaintext: 'vault payload',
        key: await derivePasskeyVaultKey({
          prfOutput: new Uint8Array(32).fill(1),
          salt
        }),
        salt,
        prfSalt: new Uint8Array(32).fill(3)
      })
    } as unknown as StoredVaultRecord
  }

  it('exposes each vault envelope with its own passkey', async () => {
    const records = [await createRecord('AQID'), await createRecord('BAUG')]
    const backups = await Promise.all(
      records.map(record =>
        createRemoteVaultBackupRecord({ address, record, recoveryPhrase })
      )
    )

    expect(backups.map(backup => backup.credentialId)).toEqual([
      'AQID',
      'BAUG'
    ])
    expect(backups.map(backup => backup.envelope)).toEqual(
      records.map(record => record.envelope)
    )
    expect(JSON.stringify(backups)).not.toContain(recoveryPhrase)
  })

  it('restores every backup from the recovery phrase and address it was made for', async () => {
    const record = await createRecord('AQID')
    const backup = await createRemoteVaultBackupRecord({
      address,
      record,
      recoveryPhrase
    })

    await expect(
      decryptRemoteVaultBackupRecord({ address, backup, recoveryPhrase })
    ).resolves.toEqual(record)
    await expect(
      decryptRemoteVaultBackupRecord({
        address,
        backup,
        recoveryPhrase: 'other wallet phrase'
      })
    ).rejects.toThrow()
    await expect(
      decryptRemoteVaultBackupRecord({
        address: '0x51E10ad4Eeb79e154bEe841FcBBAc83112122c7c',
        backup,
        recoveryPhrase
      })
    ).rejects.toThrow()
  })

  it('rejects backups without a valid vault envelope', async () => {
    const backup = await createRemoteVaultBackupRecord({
      address,
      record: await createRecord('AQID'),
      recoveryPhrase
    })

    expect(
      parseRemoteVaultBackupPackage(
        createRemoteVaultBackupPackage({ address, backups: [backup] })
      ).backups
    ).toEqual([backup])
    expect(() =>
      parseRemoteVaultBackupPackage({
        version: 1,
        address,
        backups: [{ ...backup, envelope: { ...backup.envelope, keyVersion: 1 } }]
      })
    ).toThrow('Unsupported encrypted backup format.')
  })
})
