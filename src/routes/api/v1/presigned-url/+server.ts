import { json, error } from '@sveltejs/kit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RequestHandler } from './$types';
import { getS3Client } from '$lib/s3';
import { PUBLIC_S3_BUCKET } from '$env/static/public';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { 
      key, 
      contentType = 'application/octet-stream',
      bucket = PUBLIC_S3_BUCKET
    } = data;

    if (!key) {
      return error(400, 'Missing key');
    }

    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // Storj supports standard S3 ACLs
      ACL: 'public-read'
    });

    // Generate presigned URL with 15-minute expiration
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    console.log('Generated presigned URL for', key);

    return json({ url: presignedUrl });
  } catch (err) {
    console.error('Presigned URL generation error:', err);
    return error(500, 'Failed to generate upload URL');
  }
};
