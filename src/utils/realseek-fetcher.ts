import { fetchJsonWithIPv4Fallback } from './http-json'

export const DEFAULT_REALSEEK_URL = 'https://cch-plus.com/pricing/v1/models.json'

const REALSEEK_TIMEOUT_MS = 30000

const realseekCaches = new Map<string, Promise<unknown>>()

export async function fetchRealseekData(source: string = DEFAULT_REALSEEK_URL): Promise<unknown> {
  const cached = realseekCaches.get(source)
  if (cached) return cached

  const request = (async () => {
    return fetchJsonWithIPv4Fallback(source, REALSEEK_TIMEOUT_MS)
  })()

  realseekCaches.set(source, request)

  try {
    const data = await request
    if (data === undefined) {
      // Do not cache failures so a later manual refresh can retry.
      realseekCaches.delete(source)
    }
    return data
  } catch (error) {
    realseekCaches.delete(source)
    throw error
  }
}

export const realseekTestUtils = {
  resetCache(): void {
    realseekCaches.clear()
  },
}
