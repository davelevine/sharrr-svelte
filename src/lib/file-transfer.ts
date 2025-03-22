import axios from 'axios'
import axiosRetry from 'axios-retry'

import { encryptFile, decryptData, createHash, signMessage } from '$lib/crypto'
import { api, asyncPool } from '$lib/api'

// If the request fails, we retry
axiosRetry(axios, { retries: 5, retryDelay: axiosRetry.exponentialDelay })

type SignedUrlGetResponse = {
  url: string
}
type PresignedPostResponse = { url: string; fields: Record<string, string> }

type Chunk = {
  key: string
  signature: string
  size: number
}

export type FileMeta = {
  name: string
  size: number
  mimeType: string
  isSingleChunk: boolean
}
export type FileReference = {
  bucket: string
  chunks: Chunk[]
}

export interface SecretFile extends FileMeta, FileReference {
  alias: string
  decryptionKey: string
  progress: number
}

type HandleFileEncryptionAndUpload = {
  file: File
  bucket: string
  masterKey: string
  privateKey: CryptoKey
  chunkSize: number
  progressCallback: (progress: number) => void
}
export const handleFileEncryptionAndUpload = async ({
  file,
  bucket,
  masterKey,
  privateKey,
  chunkSize,
  progressCallback
}: HandleFileEncryptionAndUpload): Promise<Chunk[]> => {
  const fileSize = file.size
  const numberOfChunks = typeof chunkSize === 'number' ? Math.ceil(fileSize / chunkSize) : 1
  const concurrentUploads = Math.min(3, numberOfChunks)
  const progressOfEachChunk: number[] = []
  progressCallback(0)

  if (!fileSize) {
    throw new Error('Empty file (zero bytes). Please select another file.')
  }

  return asyncPool(concurrentUploads, [...new Array(numberOfChunks).keys()], async (i: number) => {
    const start = i * chunkSize
    const end = i + 1 === numberOfChunks ? fileSize : (i + 1) * chunkSize
    const chunk = file.slice(start, end)

    const encryptedFile = await encryptFile(chunk, masterKey)

    const chunkFileSize = encryptedFile.size
    const fileName = crypto.randomUUID()
    const signature = await signMessage(fileName, privateKey)

    await uploadFileChunk({
      bucket,
      chunk: encryptedFile,
      fileName: await createHash(fileName),
      size: chunkFileSize,
      progressCallback: (p) => {
        progressOfEachChunk[i] = p
        const sum = (progressOfEachChunk.reduce((a, b) => a + b, 0) / numberOfChunks) * 100
        progressCallback(sum)
      }
    })

    return {
      key: fileName,
      signature,
      size: chunk.size
    }
  })
}

type UploadFileChunkParams = {
  bucket: string
  chunk: Blob
  fileName: string
  size: number
  progressCallback: (progress: number) => void
}

const uploadFileChunk = async ({
  bucket,
  chunk,
  size,
  fileName,
  progressCallback
}: UploadFileChunkParams): Promise<void> => {
  progressCallback(0)

  try {
    // Convert chunk to base64 for JSON transport
    const reader = new FileReader();
    const chunkAsBase64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(
        (reader.result as string).split(',')[1]
      );
      reader.readAsDataURL(chunk);
    });

    // Use our server-side proxy instead of direct S3 upload
    await api('/upload-proxy', {
      method: 'POST'
    }, {
      key: fileName,
      content: chunkAsBase64,
      contentType: 'application/octet-stream',
      bucket
    });

    // Simulate progress since we can't track it with the proxy
    progressCallback(1);
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload file chunk');
  }
}

const chunkDownload = async ({
  alias,
  bucket,
  chunk
}: Pick<SecretFile, 'alias' | 'bucket'> & { chunk: Chunk }) => {
  const { key, signature } = chunk
  const keyHash = await createHash(key)

  const { url } = await api<SignedUrlGetResponse>(
    `/files/${key}`,
    { method: 'POST' },
    { alias, bucket, keyHash, signature }
  )
  const response = await fetch(url)

  if (!response.ok || !response.body) {
    throw new Error(`Couldn't retrieve file - it may no longer exist.`)
  }
  return response
}

// Function runs in Service Worker, which means no access to DOM, etc.
export const handleFileChunksDownload = (file: SecretFile) => {
  const { alias, chunks, bucket, decryptionKey } = file

  let loaded = 0
  const totalSize = chunks.map((o) => o['size']).reduce((a, b) => a + b)

  const decryptionStream = new ReadableStream({
    async start(controller) {
      // We download the chunks in sequence.
      // We could do concurrent fetching but the order of the chunks in the stream is important.
      for (const chunk of chunks) {
        const response = await chunkDownload({ alias, bucket, chunk })

        // This stream is for reading the download progress
        const res = new Response(
          new ReadableStream({
            async start(controller) {
              const reader = response.body!.getReader()
              for (;;) {
                const { done, value } = await reader.read()
                if (done) {
                  break
                }
                loaded += value.byteLength
                file.progress = loaded / totalSize
                controller.enqueue(value)
              }
              controller.close()
            }
          })
        )

        const encryptedFileChunk = await res.blob()
        const decryptedFileChunk = await decryptData(encryptedFileChunk, decryptionKey)

        controller.enqueue(new Uint8Array(decryptedFileChunk))
      }

      controller.close()
    }
  })

  return decryptionStream
}
