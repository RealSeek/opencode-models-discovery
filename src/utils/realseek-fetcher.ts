export const DEFAULT_REALSEEK_URL = 'https://cch-plus.com/pricing/v1/models.json'

const realseekCaches = new Map<string, unknown>()

export async function fetchRealseekData(source: string = DEFAULT_REALSEEK_URL): Promise<unknown> {
  const cached = realseekCaches.get(source)
  if (cached !== undefined) return cached

  try {
    const response = await fetch(source, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return undefined

    const data = await response.json()
    realseekCaches.set(source, data)
    return data
  } catch {
    return undefined
  }
}

export const realseekTestUtils = {
  resetCache(): void {
    realseekCaches.clear()
  },
}
