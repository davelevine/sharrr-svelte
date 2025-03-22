import { api } from '$lib/api';

// This function replaces the S3 upload in the original handleFileEncryptionAndUpload
export async function uploadToS3Proxy(encryptedContent: ArrayBuffer, key: string): Promise<void> {
  // Convert ArrayBuffer to base64 string for JSON transport
  const base64Content = btoa(
    new Uint8Array(encryptedContent)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  // Use our server-side proxy
  await api('/api/v1/upload-proxy', {
    method: 'POST'
  }, {
    key,
    content: base64Content,
    contentType: 'application/octet-stream'
  });
}
