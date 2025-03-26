import { S3Client } from '@aws-sdk/client-s3'
import { S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT } from '$env/static/private'
import { PUBLIC_ENV, PUBLIC_S3_REGION } from '$env/static/public'

export const getS3Client = () => {
  return new S3Client({
    region: PUBLIC_S3_REGION || 'us-west-001',
    endpoint: `https://${S3_ENDPOINT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY
    }
  })
}
