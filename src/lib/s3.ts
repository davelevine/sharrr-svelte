import { S3Client } from '@aws-sdk/client-s3'
// Runtime env, not build-time: these are real credentials and the published image
// is public, so `$env/static/private` (inlined at build) would bake them into
// pullable layers. `$env/dynamic/private` reads process.env at request time.
import { env } from '$env/dynamic/private'
import { PUBLIC_S3_REGION } from '$env/static/public'

export const getS3Client = () => {
  return new S3Client({
    region: PUBLIC_S3_REGION || 'us-west-001',
    endpoint: `https://${env.S3_ENDPOINT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY ?? '',
      secretAccessKey: env.S3_SECRET_KEY ?? ''
    }
  })
}
