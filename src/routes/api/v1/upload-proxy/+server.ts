import { json, error } from '@sveltejs/kit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { RequestHandler } from './$types';
import { getS3Client } from '$lib/s3';
import { PUBLIC_S3_BUCKET } from '$env/static/public';

export const POST: RequestHandler = async ({ request }) => {
    try {
      const data = await request.json();
      const { 
        key, 
        content, 
        contentType = 'application/octet-stream',
        bucket = PUBLIC_S3_BUCKET // Allow overriding bucket
      } = data;
  
      if (!key || !content) {
        return error(400, 'Missing key or content');
      }
  
      // Convert base64 content to buffer
      const buffer = Buffer.from(content, 'base64');
  
      // Upload directly to B2 from server
      const client = getS3Client();
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read'
      }));
  
      return json({ success: true, key });
    } catch (err) {
      console.error('Upload proxy error:', err);
      return error(500, 'Upload failed');
    }
  };