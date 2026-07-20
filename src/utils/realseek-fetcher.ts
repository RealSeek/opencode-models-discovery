export const DEFAULT_REALSEEK_URL = 'https://cch-plus.com/pricing/v1/models.json'

const realseekCaches = new Map<string, Promise<unknown>>()

export async function fetchRealseekData(source: string = DEFAULT_REALSEEK_URL): Promise<unknown> {
  const cached = realseekCaches.get(source)
  if (cached) return cached

  const request = (async () => {
    try {
      const response = await fetch(source, {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) return undefined

      return await response.json()
    } catch {
      return undefined
    }
  })()

  realseekCaches.set(source, request)
  return request
}

export const realseekTestUtils = {
  resetCache(): void {
    realseekCaches.clear()
  },
}
