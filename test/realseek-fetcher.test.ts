import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRealseekData, realseekTestUtils } from '../src/utils/realseek-fetcher.ts'

const mockFetch = vi.fn()

describe('realseek fetcher', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    realseekTestUtils.resetCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonResponse(data: unknown): Response {
    return {
      ok: true,
      json: async () => data,
    } as unknown as Response
  }

  it('should share in-flight requests for the same source', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ models: [] }))

    const [first, second] = await Promise.all([
      fetchRealseekData('https://example.com/models.json'),
      fetchRealseekData('https://example.com/models.json'),
    ])

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ models: [] })
    expect(second).toEqual({ models: [] })
  })

  it('should cache successful responses', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ models: [{ slug: 'a' }] }))

    await fetchRealseekData('https://example.com/models.json')
    const again = await fetchRealseekData('https://example.com/models.json')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(again).toEqual({ models: [{ slug: 'a' }] })
  })

  it('should not cache failed requests so a refresh can retry', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce(jsonResponse({ models: [{ slug: 'retried' }] }))

    const failed = await fetchRealseekData('https://example.com/models.json')
    expect(failed).toBeUndefined()

    const retried = await fetchRealseekData('https://example.com/models.json')
    expect(retried).toEqual({ models: [{ slug: 'retried' }] })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
