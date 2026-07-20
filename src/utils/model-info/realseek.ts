import type { ModelInfoEnricher, ModelInfoEnricherOptions } from './types'

interface RealseekCharge {
  unit?: string
  price?: string | number
}

interface RealseekPricing {
  provider?: string
  official?: boolean
  charges?: Record<string, RealseekCharge>
}

interface RealseekModel {
  slug?: string
  model_name?: string
  display_name?: string
  aliases?: string[]
  vendor?: string
  max_input_tokens?: number
  max_output_tokens?: number
  modalities?: {
    input?: string[]
    output?: string[]
  }
  parameters?: {
    unsupported?: string[]
  }
  capabilities?: {
    vision?: boolean
    function_calling?: boolean
    reasoning?: boolean
    structured_output?: boolean
    pdf_input?: boolean
  }
  pricing?: RealseekPricing[]
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function getModelKeys(model: RealseekModel): string[] {
  return [
    model.slug,
    model.model_name,
    ...(Array.isArray(model.aliases) ? model.aliases : []),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function getLookupKeys(value: string): string[] {
  const clean = value.replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/')
  return [...new Set([clean, parts[parts.length - 1]])]
}

function buildModelMap(data: unknown): Map<string, RealseekModel> {
  const models = isObject(data) && Array.isArray(data.models) ? data.models : []
  const result = new Map<string, RealseekModel>()

  for (const model of models) {
    if (!isObject(model)) continue
    const typedModel = model as RealseekModel
    for (const key of getModelKeys(typedModel).flatMap(getLookupKeys)) {
      if (!result.has(key.toLowerCase())) {
        result.set(key.toLowerCase(), typedModel)
      }
    }
  }

  return result
}

function selectPricing(model: RealseekModel): RealseekPricing | undefined {
  const pricing = Array.isArray(model.pricing) ? model.pricing : []
  return pricing.find((entry) => entry.official === true)
    ?? pricing.find((entry) => entry.provider === model.vendor)
    ?? pricing[0]
}

function getModelInfo(modelMap: Map<string, RealseekModel>, modelId: string): RealseekModel | undefined {
  for (const key of getLookupKeys(modelId)) {
    const model = modelMap.get(key.toLowerCase())
    if (model) return model
  }
  return undefined
}

function applyCost(modelConfig: any, pricing: RealseekPricing | undefined, multiplier: number): void {
  const charges = pricing?.charges
  if (!charges) return

  const input = asFiniteNumber(charges.prompt?.price)
  const output = asFiniteNumber(charges.completion?.price)
  const cacheRead = asFiniteNumber(charges.cache_read?.price)
  const cacheWrite = asFiniteNumber(charges.cache_write?.price)
  if (input === undefined && output === undefined && cacheRead === undefined && cacheWrite === undefined) return

  modelConfig.cost = {
    ...(input !== undefined ? { input: input * multiplier } : {}),
    ...(output !== undefined ? { output: output * multiplier } : {}),
    ...(cacheRead !== undefined ? { cache_read: cacheRead * multiplier } : {}),
    ...(cacheWrite !== undefined ? { cache_write: cacheWrite * multiplier } : {}),
  }
}

function applyRealseekModelInfo(modelConfig: any, model: RealseekModel | undefined, multiplier: number): void {
  if (!model) return

  const context = asFiniteNumber(model.max_input_tokens)
  const output = asFiniteNumber(model.max_output_tokens)
  if (context !== undefined || output !== undefined) {
    modelConfig.limit = {
      ...modelConfig.limit,
      ...(context !== undefined ? { context, input: context } : {}),
      ...(output !== undefined ? { output } : {}),
    }
  }

  const modalities = model.modalities
  if (modalities?.input?.length || modalities?.output?.length) {
    modelConfig.modalities = {
      ...modelConfig.modalities,
      ...(modalities.input?.length ? { input: modalities.input } : {}),
      ...(modalities.output?.length ? { output: modalities.output } : {}),
    }
  }

  const capabilities = model.capabilities ?? {}
  if (typeof capabilities.vision === 'boolean' || typeof capabilities.pdf_input === 'boolean') {
    modelConfig.attachment = capabilities.vision === true || capabilities.pdf_input === true
  }
  if (typeof capabilities.reasoning === 'boolean') modelConfig.reasoning = capabilities.reasoning
  if (typeof capabilities.function_calling === 'boolean') modelConfig.tool_call = capabilities.function_calling
  if (typeof capabilities.structured_output === 'boolean') modelConfig.structured_output = capabilities.structured_output
  if (Array.isArray(model.parameters?.unsupported) && model.parameters.unsupported.includes('temperature')) {
    modelConfig.temperature = false
  }

  applyCost(modelConfig, selectPricing(model), multiplier)
}

export function createRealseekModelInfoEnricher(
  data: unknown,
  options: ModelInfoEnricherOptions
): ModelInfoEnricher {
  const modelMap = buildModelMap(data)
  const multiplier = options.costMultiplier ?? 1

  return {
    shouldSkipModel(): boolean {
      return false
    },
    getModelName(modelId: string): string | undefined {
      return getModelInfo(modelMap, modelId)?.display_name
    },
    applyModelInfo(modelConfig: any, modelId: string): void {
      applyRealseekModelInfo(modelConfig, getModelInfo(modelMap, modelId), multiplier)
    },
  }
}
