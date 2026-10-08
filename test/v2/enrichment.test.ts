import { describe, expect, it, vi, afterEach } from "vitest"
import { discoverInventory } from "../../src/v2/discovery.js"
import { parseProviderDiscoveryOptions } from "../../src/v2/provider-config.js"
import { ModelInfoFormat } from "../../src/types/plugin-config.js"

describe("V2 provider discovery with metadata enrichment", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("enriches models using bifrost inline metadata", async () => {
    const options = new Map([
      ["local", parseProviderDiscoveryOptions({
        enabled: true,
        smartModelName: true,
        modelInfoFormat: ModelInfoFormat.Bifrost,
      })!],
    ])

    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          id: "bifrost-chat",
          context_length: 64_000,
          max_output_tokens: 8_192,
          architecture: {
            input_modalities: ["text", "image"],
          },
          supports_reasoning: true,
        }],
      }),
    })

    const inventory = await discoverInventory([{
      id: "local",
      package: "@opencode-ai/ai/providers/openai-compatible",
      settings: { baseURL: "http://127.0.0.1:1234/v1" },
    }], options, fetcher as unknown as typeof fetch)

    const model = inventory.get("local")?.get("bifrost-chat")
    expect(model).toBeDefined()
    expect(model?.limit.context).toBe(64_000)
    expect(model?.limit.output).toBe(8_192)
    expect(model?.capabilities.input).toContain("image")
    expect((model as any).reasoning).toBe(true)
  })

  it("queries external litellm endpoint and filters non-chat models", async () => {
    const options = new Map([
      ["local", parseProviderDiscoveryOptions({
        enabled: true,
        smartModelName: true,
        modelInfoFormat: ModelInfoFormat.LiteLLM,
        filterNonChat: true,
      })!],
    ])

    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("/model/info")) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { model_name: "chat-gpt", model_info: { max_tokens: 4096, max_input_tokens: 128000, mode: "chat" } },
              { model_name: "text-embed", model_info: { mode: "embedding" } },
            ],
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: "chat-gpt" },
            { id: "text-embed" },
          ],
        }),
      } as Response
    })

    const inventory = await discoverInventory([{
      id: "local",
      package: "@opencode-ai/ai/providers/openai-compatible",
      settings: { baseURL: "http://127.0.0.1:1234/v1" },
    }], options, fetcher as unknown as typeof fetch)

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1/model/info",
      expect.anything()
    )
    const models = inventory.get("local")!
    expect(models.has("chat-gpt")).toBe(true)
    expect(models.has("text-embed")).toBe(false)
    expect(models.get("chat-gpt")?.limit.context).toBe(128_000)
  })

  it("enriches models with realseek pricing and applies costMultiplier", async () => {
    const { realseekTestUtils } = await import("../../src/utils/realseek-fetcher.js")
    realseekTestUtils.resetCache()

    const options = new Map([
      ["local", parseProviderDiscoveryOptions({
        enabled: true,
        smartModelName: true,
        modelInfoFormat: ModelInfoFormat.Realseek,
        costMultiplier: 2.5,
        modelInfoEndpoint: "https://example.com/realseek-models.json",
      })!],
    ])

    const fetcher = vi.fn(async (url: string) => {
      if (url === "https://example.com/realseek-models.json") {
        return {
          ok: true,
          json: async () => ({
            models: [{
              slug: "openai/gpt-5.6-sol",
              model_name: "gpt-5.6-sol",
              display_name: "GPT-5.6 Sol",
              max_input_tokens: 1_050_000,
              max_output_tokens: 128_000,
              capabilities: { reasoning: true, function_calling: true },
              pricing: [{
                provider: "openai",
                official: true,
                charges: {
                  prompt: { price: "5" },
                  completion: { price: "30" },
                  cache_read: { price: "0.5" },
                  cache_write: { price: "6.25" },
                },
              }],
            }],
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ data: [{ id: "gpt-5.6-sol" }] }),
      } as Response
    })
    vi.stubGlobal("fetch", fetcher)

    const inventory = await discoverInventory([{
      id: "local",
      package: "@opencode-ai/ai/providers/openai-compatible",
      settings: { baseURL: "http://127.0.0.1:1234/v1" },
    }], options, fetcher as unknown as typeof fetch)

    const model = inventory.get("local")?.get("gpt-5.6-sol")
    expect(model).toBeDefined()
    expect(model?.name).toBe("GPT-5.6 Sol")
    expect(model?.limit.context).toBe(1_050_000)
    expect(model?.limit.output).toBe(128_000)
    expect((model as any).reasoning).toBe(true)
    expect((model as any).cost).toEqual([{
      input: 12.5,
      output: 75,
      cache: { read: 1.25, write: 15.625 },
    }])
  })

  it("overlays models.dev-compatible corrections from modelInfoOverrideEndpoint", async () => {
    const { modelsDevTestUtils } = await import("../../src/utils/models-dev-fetcher.js")
    modelsDevTestUtils.resetCache()

    const options = new Map([
      ["local", parseProviderDiscoveryOptions({
        enabled: true,
        smartModelName: true,
        modelInfoFormat: ModelInfoFormat.ModelsDev,
        modelInfoEndpoint: "https://example.com/base-models.json",
        modelInfoOverrideEndpoint: "https://example.com/corrections.json",
      })!],
    ])

    const fetcher = vi.fn(async (url: string) => {
      if (url === "https://example.com/base-models.json") {
        return {
          ok: true,
          json: async () => ({
            "vendor/new-model": {
              name: "Base Name",
              reasoning: true,
              limit: { context: 200_000, input: 180_000, output: 32_000 },
              variants: { low: { reasoningEffort: "low", reasoningSummary: "auto" } },
            },
          }),
        } as Response
      }
      if (url === "https://example.com/corrections.json") {
        return {
          ok: true,
          json: async () => ({
            "vendor/new-model": {
              name: "Corrected Name",
              variants: { high: { reasoningEffort: "high" } },
            },
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ data: [{ id: "vendor/new-model" }] }),
      } as Response
    })
    vi.stubGlobal("fetch", fetcher)

    const inventory = await discoverInventory([{
      id: "local",
      package: "@opencode-ai/ai/providers/openai-compatible",
      settings: { baseURL: "http://127.0.0.1:1234/v1" },
    }], options, fetcher as unknown as typeof fetch)

    const model = inventory.get("local")?.get("vendor/new-model")
    expect(model).toBeDefined()
    expect(model?.name).toBe("Corrected Name")
    expect(model?.limit.context).toBe(200_000)
    expect(model?.limit.output).toBe(32_000)
    expect((model as any).variants).toEqual(expect.arrayContaining([
      { id: "low", settings: { reasoningEffort: "low", reasoningSummary: "auto" } },
      { id: "high", settings: { reasoningEffort: "high" } },
    ]))
  })
})
