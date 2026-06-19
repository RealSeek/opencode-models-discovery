import type { LiteLLMModelInfo, LiteLLMModelInfoEntry } from '../../types'
import type { ModelInfoEnricher, ModelInfoEnricherOptions } from './types'
import { lookupModelsDevData, type ModelsDevModel } from '../models-dev-fetcher'

function hasUsableNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function modelInfoScore(modelId: string, entry: LiteLLMModelInfoEntry): number {
  const info = entry.model_info ?? {}
  const modelIdLower = modelId.toLowerCase()
  let score = 0
  if (entry.model_name === modelId) score += 8
  if (info.key === modelId) score += 6
  if (entry.litellm_params?.model === modelId) score += 4
  if (entry.litellm_params?.model?.endsWith(`/${modelId}`)) score += 2
  if (entry.model_name?.toLowerCase() === modelIdLower) score += 3
  if (info.key?.toLowerCase() === modelIdLower) score += 2
  if (entry.litellm_params?.model?.toLowerCase() === modelIdLower) score += 2
  if (entry.litellm_params?.model?.toLowerCase().endsWith(`/${modelIdLower}`)) score += 1
  if (info.mode === 'chat') score += 5
  if (hasUsableNumber(info.max_input_tokens) || hasUsableNumber(info.max_tokens)) score += 10
  if (info.supports_reasoning === true) score += 4
  return score
}

function buildModelInfoMap(entries: LiteLLMModelInfoEntry[]): Map<string, LiteLLMModelInfoEntry> {
  const result = new Map<string, LiteLLMModelInfoEntry>()

  for (const entry of entries) {
    const keys = new Set<string>()
    if (entry.model_name) keys.add(entry.model_name)
    if (entry.model_info?.key) keys.add(entry.model_info.key)
    if (entry.litellm_params?.model) {
      keys.add(entry.litellm_params.model)
      const parts = entry.litellm_params.model.split('/')
      if (parts.length > 1) keys.add(parts.slice(1).join('/'))
      keys.add(parts[parts.length - 1])
    }

    for (const key of keys) {
      for (const lookupKey of new Set([key, key.toLowerCase()])) {
        const existing = result.get(lookupKey)
        if (!existing || modelInfoScore(lookupKey, entry) > modelInfoScore(lookupKey, existing)) {
          result.set(lookupKey, entry)
        }
      }
    }
  }

  return result
}

function createReasoningVariants(info: LiteLLMModelInfo): Record<string, any> | undefined {
  if (info.supports_reasoning !== true || !info.supported_openai_params?.includes('reasoning_effort')) {
    return undefined
  }

  const variants: Record<string, any> = {}
  if (info.supports_none_reasoning_effort === true) variants.none = { reasoningEffort: 'none' }
  if (info.supports_minimal_reasoning_effort === true) variants.minimal = { reasoningEffort: 'minimal' }

  // LiteLLM does not always expose per-tier flags for widely supported efforts.
  if (info.supports_low_reasoning_effort !== false) variants.low = { reasoningEffort: 'low' }
  variants.medium = { reasoningEffort: 'medium' }
  variants.high = { reasoningEffort: 'high' }

  if (info.supports_xhigh_reasoning_effort === true) variants.xhigh = { reasoningEffort: 'xhigh' }
  if (info.supports_max_reasoning_effort === true) variants.max = { reasoningEffort: 'max' }

  return Object.keys(variants).length > 0 ? variants : undefined
}

function applyLiteLLMModelInfo(
  modelConfig: any, 
  entry: LiteLLMModelInfoEntry | undefined,
  modelsDevCache?: Map<string, ModelsDevModel>
): void {
  const info = entry?.model_info
  if (!info) return

  const DEFAULT_CONTEXT = 200000
  const DEFAULT_OUTPUT = 32000

  let contextLimit = hasUsableNumber(info.max_input_tokens) 
    ? info.max_input_tokens 
    : hasUsableNumber(info.max_tokens)
      ? info.max_tokens
      : undefined

  let outputLimit = hasUsableNumber(info.max_output_tokens) 
    ? info.max_output_tokens 
    : hasUsableNumber(info.max_tokens)
      ? info.max_tokens
      : undefined

  let modelsDevData: ModelsDevModel | undefined
  if (modelsDevCache) {
    modelsDevData = lookupModelsDevData(modelConfig.id, modelsDevCache)
  }

  if ((!hasUsableNumber(contextLimit) || !hasUsableNumber(outputLimit)) && modelsDevData?.limit) {
    if (!hasUsableNumber(contextLimit)) {
      contextLimit = modelsDevData.limit.context || modelsDevData.limit.input
    }
    if (!hasUsableNumber(outputLimit)) {
      outputLimit = modelsDevData.limit.output
    }
  }

  contextLimit = hasUsableNumber(contextLimit) ? contextLimit : DEFAULT_CONTEXT
  outputLimit = hasUsableNumber(outputLimit) ? outputLimit : DEFAULT_OUTPUT

  modelConfig.limit = {
    context: contextLimit,
    input: hasUsableNumber(info.max_input_tokens) ? info.max_input_tokens : undefined,
    output: outputLimit,
  }

  if (info.supports_reasoning === true) {
    modelConfig.reasoning = true
  } else if (modelsDevData?.reasoning !== undefined) {
    modelConfig.reasoning = modelsDevData.reasoning
  }

  const variants = createReasoningVariants(info)
  if (variants) {
    modelConfig.variants = variants
  }

  if (modelsDevData) {
    if (modelsDevData.family !== undefined) {
      modelConfig.family = modelsDevData.family
    }
    if (modelsDevData.attachment !== undefined) {
      modelConfig.attachment = modelsDevData.attachment
    }
    if (modelsDevData.tool_call !== undefined) {
      modelConfig.tool_call = modelsDevData.tool_call
    }
    if (modelsDevData.structured_output !== undefined) {
      modelConfig.structured_output = modelsDevData.structured_output
    }
    if (modelsDevData.temperature !== undefined) {
      modelConfig.temperature = modelsDevData.temperature
    }
    if (modelsDevData.knowledge !== undefined && modelsDevData.knowledge !== null) {
      modelConfig.knowledge = modelsDevData.knowledge
    }
    if (modelsDevData.release_date !== undefined) {
      modelConfig.release_date = modelsDevData.release_date
    }
    if (modelsDevData.last_updated !== undefined) {
      modelConfig.last_updated = modelsDevData.last_updated
    }
    if (modelsDevData.modalities !== undefined) {
      modelConfig.modalities = modelsDevData.modalities
    }
    if (modelsDevData.open_weights !== undefined) {
      modelConfig.open_weights = modelsDevData.open_weights
    }
    if (modelsDevData.weights !== undefined && modelsDevData.weights !== null) {
      modelConfig.weights = modelsDevData.weights
    }
    if (modelsDevData.benchmarks !== undefined && modelsDevData.benchmarks !== null) {
      modelConfig.benchmarks = modelsDevData.benchmarks
    }
    if (modelsDevData.pricing !== undefined && modelsDevData.pricing !== null) {
      modelConfig.pricing = modelsDevData.pricing
    }
  }
}

function getModelInfo(modelInfoById: Map<string, LiteLLMModelInfoEntry>, modelId: string): LiteLLMModelInfoEntry | undefined {
  return modelInfoById.get(modelId) ?? modelInfoById.get(modelId.toLowerCase())
}

export function createLiteLLMModelInfoEnricher(
  data: unknown,
  options: ModelInfoEnricherOptions
): ModelInfoEnricher {
  const response = data as { data?: LiteLLMModelInfoEntry[] } | undefined
  const modelInfoById = buildModelInfoMap(Array.isArray(response?.data) ? response.data : [])

  return {
    shouldSkipModel(modelId: string): boolean {
      if (!options.filterNonChat) return false
      const mode = getModelInfo(modelInfoById, modelId)?.model_info?.mode
      return typeof mode === 'string' && mode.length > 0 && mode !== 'chat'
    },
    applyModelInfo(modelConfig: any, modelId: string): void {
      applyLiteLLMModelInfo(
        modelConfig, 
        getModelInfo(modelInfoById, modelId),
        options.modelsDevCache
      )
    },
  }
}
