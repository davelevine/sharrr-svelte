import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
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
    // For Backblaze B2, we need to be careful with how we structure the presigned post
    const post = await createPresignedPost(getS3Client(), {
      Bucket,
      Key: key, // This is the correct parameter to use
      Fields: {
        acl: 'bucket-owner-full-control'
        // Don't include key here as it's causing duplication
      },
      Expires: 3 * 60 * 60, // seconds -> 3h
      Conditions: [
        { 'Content-Type': 'application/octet-stream' }
      ]
    })

    return json(post)
  } catch (err) {
    console.error(err)
    error(400, 'Something went wrong.');
  }
}
