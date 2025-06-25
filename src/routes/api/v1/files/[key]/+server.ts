import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { json, error } from '@sveltejs/kit'
import type { RequestEvent } from './$types'

import { verifyMessageSignature, importPublicKey } from '$lib/crypto'
import { getS3Client } from '$lib/s3'

import prisma from '$lib/prisma'

export const POST = async ({ params, request }: RequestEvent) => {
  const body = await request.json()
  const { alias, bucket, keyHash, signature } = body

  const Bucket = bucket
  const Key = keyHash

  // const resourceAccessToken = request.headers['X-Sharrr-Access-Token']

  if (!Key) {
    error(400, 'No file key provided.');
  }

  const secret = await prisma.secret.findUnique({ where: { alias: alias } })

  if (!secret) {
    error(400, `No database entry for alias ${alias}.`);
  }

  // Here we check if the requested file belongs to the "owner" via signature.
  const publicKey = await importPublicKey(secret.publicKey)
  if (!publicKey) {
    error(400, `Public key missing or invalid.`);
  }
  const isSignatureValid = verifyMessageSignature(params.key, signature, publicKey)
  if (!isSignatureValid) {
    error(400, `Invalid signature`);
  }

  try {
    // Generate a presigned URL for downloading from MinIO
    const bucketParams = {
      Bucket,
      Key,
      // Remove ACL for MinIO as it's not needed for GET operations
      // ACL: 'public-read'
    }

    const client = getS3Client();
    const command = new GetObjectCommand(bucketParams);

    // Increase expiration time for better user experience
    const url = await getSignedUrl(client, command, {
      expiresIn: 3600 // 1 hour
    });

    if (!url) {
      error(400, `Couldn't get signed url. File may no longer exist.`);
    }

    console.log(`Generated download URL for ${Key} in bucket ${Bucket}`);
    return json({ url });
  } catch (err) {
    console.error('Error generating download URL:', err);
    error(500, `Failed to generate download URL: ${err.message}`);
  }
}
