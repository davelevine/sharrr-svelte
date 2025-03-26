import { json, error } from '@sveltejs/kit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { RequestHandler } from './$types';
import { getS3Client } from '$lib/s3';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { key, content, contentType = 'application/octet-stream', bucket } = data;

    if (!key || !content || !bucket) {
      return error(400, 'Missing required fields');
    }

    // Decode base64 content
    const binaryContent = Buffer.from(content, 'base64');

    // Upload to Storj
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: binaryContent,
        ContentType: contentType,
        ACL: 'public-read'
      })
    );

    return json({ success: true });
  } catch (err) {
    console.error('Proxy upload error:', err);
    return error(500, 'Failed to upload file');
  }
};
