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
  fileName,
  size,
  progressCallback
}: UploadFileChunkParams): Promise<void> => {
  progressCallback(0);

  // Try direct upload first
  try {
    console.log('Attempting direct upload to Storj for file:', fileName);

    // Get presigned URL from your server
    const presignedResponse = await fetch('/api/v1/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: fileName,
        contentType: 'application/octet-stream',
        bucket
      })
    });

    if (!presignedResponse.ok) {
      const errorText = await presignedResponse.text();
      throw new Error(`Failed to get presigned URL: ${presignedResponse.status} ${errorText}`);
    }

    const { url } = await presignedResponse.json();
    console.log('Got presigned URL for Storj upload');

    // Upload directly to Storj using fetch for better error handling
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: chunk
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload to Storj failed with status ${uploadResponse.status}: ${errorText}`);
    }

    console.log('Direct upload to Storj successful!');
    progressCallback(1);
    return; // Success!
  } catch (directUploadError) {
    console.warn('Direct upload to Storj failed, falling back to proxy:', directUploadError);
  }

  // Fall back to proxy upload
  try {
    console.log('Using proxy upload for file:', fileName);

    // Convert chunk to base64 for JSON transport
    const reader = new FileReader();
    const chunkAsBase64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(
        (reader.result as string).split(',')[1]
      );
      reader.readAsDataURL(chunk);
    });

    // Use server-side proxy
    await api('/upload-proxy', {
      method: 'POST'
    }, {
      key: fileName,
      content: chunkAsBase64,
      contentType: 'application/octet-stream',
      bucket
    });

    console.log('Proxy upload successful!');
    progressCallback(1);
  } catch (proxyError) {
    console.error('Proxy upload failed:', proxyError);
    throw new Error(`Failed to upload file chunk through proxy: ${proxyError.message}`);
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
