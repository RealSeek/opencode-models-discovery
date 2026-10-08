import { describe, expect, it, vi } from 'vitest'
import { getConfigHookTimeoutMs } from '../src/plugin/config-hook'
import type { PluginLogger } from '../src/plugin/logger'

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => logger,
}

describe('config hook timeout', () => {
  it('waits for discovery to complete by default', () => {
    expect(getConfigHookTimeoutMs({}, logger)).toBeUndefined()
    expect(logger.debug).toHaveBeenCalledWith('Using config hook timeout', {
      timeoutMs: undefined,
    })
  })

  it('uses the largest configured provider request timeout', () => {
    const config = {
      provider: {
        fast: { options: { modelsDiscovery: { timeoutMs: 3000 } } },
        slow: { options: { modelsDiscovery: { timeoutMs: 7500 } } },
      },
    }

    expect(getConfigHookTimeoutMs(config, logger)).toBe(7500)
    expect(logger.debug).toHaveBeenCalledWith('Using config hook timeout', {
      timeoutMs: 7500,
    })
  })

  it('uses the configured timeout even when it is small', () => {
    const config = {
      provider: {
        fast: { options: { modelsDiscovery: { timeoutMs: 1000 } } },
      },
    }

    expect(getConfigHookTimeoutMs(config, logger)).toBe(1000)
  })
})
