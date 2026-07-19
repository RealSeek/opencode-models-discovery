import type { ModelInfoEnricher } from './types'
import { lookupModelsDevData, type ModelsDevModel } from '../models-dev-fetcher'

function hasUsableNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function applyModelsDevModelInfo(modelConfig: any, info: ModelsDevModel | undefined): void {
  if (!info) return

  const contextLimit = hasUsableNumber(info.limit?.context) ? info.limit.context : info.limit?.input
  const outputLimit = info.limit?.output
  if (hasUsableNumber(contextLimit) || hasUsableNumber(outputLimit)) {
    modelConfig.limit = {
      ...modelConfig.limit,
      ...(hasUsableNumber(contextLimit) ? { context: contextLimit } : {}),
      ...(hasUsableNumber(info.limit?.input) ? { input: info.limit.input } : {}),
      ...(hasUsableNumber(outputLimit) ? { output: outputLimit } : {}),
    }
  }

  if (typeof info.attachment === 'boolean') modelConfig.attachment = info.attachment
  if (typeof info.reasoning === 'boolean') modelConfig.reasoning = info.reasoning
  if (typeof info.tool_call === 'boolean') modelConfig.tool_call = info.tool_call
  if (typeof info.structured_output === 'boolean') modelConfig.structured_output = info.structured_output
  if (typeof info.temperature === 'boolean') modelConfig.temperature = info.temperature
  if (info.interleaved !== undefined) modelConfig.interleaved = info.interleaved
  if (info.modalities?.input?.length || info.modalities?.output?.length) {
    modelConfig.modalities = {
      ...modelConfig.modalities,
      ...(info.modalities.input?.length ? { input: info.modalities.input } : {}),
      ...(info.modalities.output?.length ? { output: info.modalities.output } : {}),
    }
  }
  if (info.variants && Object.keys(info.variants).length > 0) {
    const variants: Record<string, Record<string, unknown>> = { ...(modelConfig.variants ?? {}) }
    for (const [name, options] of Object.entries(info.variants)) {
      variants[name] = {
        ...(variants[name] ?? {}),
        ...options,
      }
    }
    modelConfig.variants = variants
  }
}

export function createModelsDevModelInfoEnricher(data: unknown): ModelInfoEnricher {
  const cache = data instanceof Map ? data as Map<string, ModelsDevModel> : new Map<string, ModelsDevModel>()

  return {
    shouldSkipModel(): boolean {
      return false
    },
    getModelName(modelId: string): string | undefined {
      return lookupModelsDevData(modelId, cache)?.name
    },
    applyModelInfo(modelConfig: any, modelId: string): void {
      applyModelsDevModelInfo(modelConfig, lookupModelsDevData(modelId, cache))
    },
  }
}
