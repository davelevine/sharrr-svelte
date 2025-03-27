import { json, error } from '@sveltejs/kit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { RequestHandler } from './$types';
import { getS3Client } from '$lib/s3';

export const POST: RequestHandler = async ({ request }) => {
  // Check if this is a multipart/form-data request (for better progress tracking)
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      const bucket = formData.get('bucket');

      if (!file || !(file instanceof File) || !bucket || typeof bucket !== 'string') {
        return error(400, 'Missing required fields');
      }

      // Upload to Storj
      const client = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: file.name,
          Body: await file.arrayBuffer(),
          ContentType: file.type || 'application/octet-stream',
          ACL: 'public-read'
        })
      );

      return json({ success: true });
    } catch (err) {
      console.error('Form data upload error:', err);
      return error(500, 'Failed to upload file');
    }
  }

  // Handle JSON payload (original implementation)
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
