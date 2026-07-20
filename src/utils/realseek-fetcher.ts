import { fetchJsonWithIPv4Fallback } from './http-json'

export const DEFAULT_REALSEEK_URL = 'https://cch-plus.com/pricing/v1/models.json'

const realseekCaches = new Map<string, Promise<unknown>>()

export async function fetchRealseekData(source: string = DEFAULT_REALSEEK_URL): Promise<unknown> {
  const cached = realseekCaches.get(source)
  if (cached) return cached

  const request = (async () => {
    return fetchJsonWithIPv4Fallback(source, 30000)
  })()

  realseekCaches.set(source, request)
  return request
}

export const realseekTestUtils = {
  resetCache(): void {
    realseekCaches.clear()
  },
}
