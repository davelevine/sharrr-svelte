import { S3Client } from '@aws-sdk/client-s3'
import { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY } from '$env/static/private'

export const getS3Client = () =>
  new S3Client({
    endpoint: `https://${S3_ENDPOINT}`,
    region: 'us-west-001',
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY
    },
    forcePathStyle: true
  })
