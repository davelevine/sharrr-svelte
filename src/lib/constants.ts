export const productionDomain = 'https://share.levine.io'
export const fileRetentionPeriodInDays = 7
export const MB = 10 ** 6 // 1000000 Bytes = 1 MB.
export const GB = 10 ** 9 // 1000000000 Bytes = 1 GB.

export const getMaxFileSize = (env: string) => (env === 'production' ? 10 : 1) * GB
export const getChunkSize = (env: string) => (env === 'production' ? 3 : 1) * MB
