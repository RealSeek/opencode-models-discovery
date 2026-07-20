import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRealseekData, realseekTestUtils } from '../src/utils/realseek-fetcher'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Realseek fetcher', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    realseekTestUtils.resetCache()
  })

  it('should share one in-flight request across providers', async () => {
    let resolveFetch: ((response: any) => void) | undefined
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const first = fetchRealseekData()
    const second = fetchRealseekData()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      ok: true,
      json: async () => ({ models: [{ slug: 'test/model' }] }),
    })

    await expect(first).resolves.toEqual({ models: [{ slug: 'test/model' }] })
    await expect(second).resolves.toEqual({ models: [{ slug: 'test/model' }] })
  })

  it('should cache a failed request for the current startup', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(fetchRealseekData()).resolves.toBeUndefined()
    await expect(fetchRealseekData()).resolves.toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
