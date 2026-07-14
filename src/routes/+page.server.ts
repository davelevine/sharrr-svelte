import { env } from '$env/dynamic/private'
import { PUBLIC_ENV } from '$env/static/public'
import type { PageServerLoad } from './$types'
import { productionDomain } from '$lib/constants'

const sanitizeUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`)

export const load = (() => {
  // In production the canonical domain is fixed. Otherwise fall back to the
  // adapter-node ORIGIN (set at runtime), then to productionDomain — never a
  // build-time `$env/static/private` import, which fails the build when unset.
  return {
    baseUrl:
      PUBLIC_ENV === 'production'
        ? productionDomain
        : env.ORIGIN
          ? sanitizeUrl(env.ORIGIN)
          : productionDomain
  }
}) satisfies PageServerLoad
