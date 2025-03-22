import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { error, json } from '@sveltejs/kit'
import type { RequestEvent } from './$types'

import { PUBLIC_S3_BUCKET } from '$env/static/public'
import { getS3Client } from '$lib/s3'

export const GET = async ({ url }: RequestEvent) => {
  const Bucket = PUBLIC_S3_BUCKET

  const key: string | null = url.searchParams.get('file')

  if (!key) {
    return error(400, 'File parameter missing.')
  }

  try {
    // Use request-presigner instead of presigned-post for better B2 compatibility
    const client = getS3Client()
    const command = new PutObjectCommand({
      Bucket,
      Key: key,
      ContentType: 'application/octet-stream',
      ACL: 'public-read' // Make sure file is publicly readable
    })

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: 3 * 60 * 60 // 3 hours
    })

    // Return a format compatible with the existing frontend code
    return json({
      url: presignedUrl,
      fields: {}, // Empty fields as we're not using multipart form uploads
      // Include bucket and key so frontend can construct final URL if needed
      bucket: Bucket,
      key: key
    })
  } catch (err) {
    console.error(err)
    error(400, 'Something went wrong.');
  }
}
