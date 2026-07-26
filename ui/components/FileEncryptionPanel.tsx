import { useState, type ChangeEvent } from 'react'
import { useWalletApp } from './Context'
import { downloadTextFile } from '../helpers/wallet'

export const FileEncryptionPanel = (): JSX.Element | null => {
  const {
    activeAccount,
    decryptFileWithActiveWalletKey,
    encryptFileWithActiveWalletKey,
    isBusy
  } = useWalletApp()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [encryptedJson, setEncryptedJson] = useState('')

  if (activeAccount == null) return null

  const downloadEncryptedFile = async (): Promise<void> => {
    if (selectedFile == null) return
    const encryptedPackage = await encryptFileWithActiveWalletKey(selectedFile)
    if (encryptedPackage == null) return
    downloadTextFile({
      filename: `${selectedFile.name || 'file'}.organigram-encrypted.json`,
      content: `${JSON.stringify(encryptedPackage, null, 2)}\n`
    })
  }

  const downloadBlob = ({
    bytes,
    filename,
    type
  }: {
    bytes: Uint8Array
    filename: string
    type: string
  }): void => {
    const content = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(content).set(bytes)
    const url = URL.createObjectURL(
      new Blob([content], { type: type || 'application/octet-stream' })
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadDecryptedFile = async (): Promise<void> => {
    const decryptedFile = await decryptFileWithActiveWalletKey(encryptedJson)
    if (decryptedFile == null) return
    downloadBlob({
      bytes: decryptedFile.bytes,
      filename: decryptedFile.name,
      type: decryptedFile.type
    })
    setEncryptedJson('')
  }

  return (
    <div className='panel file-encryption-panel'>
      <div className='panel-heading'>
        <div>
          <h2>Files</h2>
          <p>Encrypt and decrypt files with the active wallet key.</p>
        </div>
      </div>
      <div className='wallet-encryption-file'>
        <label>
          File to encrypt
          <input
            type='file'
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setSelectedFile(event.target.files?.[0] ?? null)
            }}
            disabled={isBusy}
          />
        </label>
        <button
          type='button'
          className='ghost-button'
          onClick={downloadEncryptedFile}
          disabled={isBusy || selectedFile == null}
        >
          Download encrypted file
        </button>
      </div>
      <div className='wallet-encryption-file'>
        <label>
          File to decrypt
          <textarea
            value={encryptedJson}
            onChange={event => setEncryptedJson(event.target.value)}
            placeholder='Paste encrypted file'
            rows={5}
            disabled={isBusy}
          />
        </label>
        <button
          type='button'
          className='ghost-button'
          onClick={downloadDecryptedFile}
          disabled={isBusy || encryptedJson.trim() === ''}
        >
          Download decrypted file
        </button>
      </div>
    </div>
  )
}
