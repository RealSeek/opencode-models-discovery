import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ModelsDevModel {
  id: string
  name?: string
  attachment?: boolean
  reasoning?: boolean
  tool_call?: boolean
  structured_output?: boolean
  temperature?: boolean
  interleaved?: true | {
    field: 'reasoning' | 'reasoning_content' | 'reasoning_details'
  }
  modalities?: {
    input?: string[]
    output?: string[]
  }
  limit?: {
    context?: number
    input?: number
    output?: number
  }
  variants?: Record<string, Record<string, unknown>>
}

export const DEFAULT_MODELS_DEV_URL = 'https://models.dev/models.json'
const PREFIX_MATCH_MIN_SCORE = 70
const PREFIX_MATCH_MIN_SHARED_PARTS = 2

const modelsDevCaches = new Map<string, Map<string, ModelsDevModel>>()

function isHttpSource(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://')
}

async function readModelsDevSource(source: string): Promise<unknown> {
  if (isHttpSource(source)) {
    const response = await fetch(source, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })

    return response.ok ? response.json() : undefined
  }

  const filePath = source.startsWith('file:')
    ? fileURLToPath(source)
    : path.resolve(source)
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toModelId(providerId: string | undefined, modelId: string): string {
  return providerId ? `${providerId}/${modelId}` : modelId
}

function addModel(cache: Map<string, ModelsDevModel>, providerId: string | undefined, rawModel: Record<string, any>, fallbackModelId?: string): void {
  const rawId = typeof rawModel.id === 'string' && rawModel.id.length > 0 ? rawModel.id : fallbackModelId
  if (!rawId) {
    return
  }

  const id = rawId.includes('/') ? rawId : toModelId(providerId, rawId)
  cache.set(id, {
    id,
    name: typeof rawModel.name === 'string' ? rawModel.name : undefined,
    attachment: typeof rawModel.attachment === 'boolean' ? rawModel.attachment : undefined,
    reasoning: typeof rawModel.reasoning === 'boolean' ? rawModel.reasoning : undefined,
    tool_call: typeof rawModel.tool_call === 'boolean' ? rawModel.tool_call : undefined,
    structured_output: typeof rawModel.structured_output === 'boolean' ? rawModel.structured_output : undefined,
    temperature: typeof rawModel.temperature === 'boolean' ? rawModel.temperature : undefined,
    interleaved: rawModel.interleaved === true
      ? true
      : isObject(rawModel.interleaved) && ['reasoning', 'reasoning_content', 'reasoning_details'].includes(rawModel.interleaved.field)
        ? { field: rawModel.interleaved.field }
        : undefined,
    modalities: isObject(rawModel.modalities) ? {
      input: Array.isArray(rawModel.modalities.input) ? rawModel.modalities.input.filter((item: unknown): item is string => typeof item === 'string') : undefined,
      output: Array.isArray(rawModel.modalities.output) ? rawModel.modalities.output.filter((item: unknown): item is string => typeof item === 'string') : undefined,
    } : undefined,
    limit: isObject(rawModel.limit) ? {
      context: typeof rawModel.limit.context === 'number' ? rawModel.limit.context : undefined,
      input: typeof rawModel.limit.input === 'number' ? rawModel.limit.input : undefined,
      output: typeof rawModel.limit.output === 'number' ? rawModel.limit.output : undefined,
    } : undefined,
    variants: isObject(rawModel.variants)
      ? Object.fromEntries(Object.entries(rawModel.variants).filter((entry): entry is [string, Record<string, unknown>] => isObject(entry[1])))
      : undefined,
  })
}

function parseModelsDevData(data: unknown): Map<string, ModelsDevModel> {
  const cache = new Map<string, ModelsDevModel>()

  if (!isObject(data)) {
    return cache
  }

  for (const [key, value] of Object.entries(data)) {
    if (!isObject(value)) {
      continue
    }

    if (isObject(value.models)) {
      for (const [modelId, model] of Object.entries(value.models)) {
        if (isObject(model)) {
          addModel(cache, key, model, modelId)
        }
      }
      continue
    }

    addModel(cache, undefined, value, key)
  }

  return cache
}

export async function fetchModelsDevData(source: string = DEFAULT_MODELS_DEV_URL): Promise<Map<string, ModelsDevModel>> {
  const cached = modelsDevCaches.get(source)
  if (cached) return cached

  try {
    const data = await readModelsDevSource(source)
    if (data === undefined) {
      return new Map()
    }

    const parsed = parseModelsDevData(data)
    modelsDevCaches.set(source, parsed)
    return parsed
  } catch {
    return new Map()
  }
}

function splitModelId(modelId: string): { provider?: string; model: string } {
  const parts = modelId.split('/')
  if (parts.length <= 1) {
    return { model: modelId }
  }

  return {
    provider: parts[0].toLowerCase(),
    model: parts.slice(1).join('/'),
  }
}

function calculatePrefixScore(modelA: string, modelB: string): number {
  const partsA = modelA.split('-')
  const partsB = modelB.split('-')
  const shorter = partsA.length <= partsB.length ? partsA : partsB
  const longer = partsA.length <= partsB.length ? partsB : partsA

  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] !== longer[i]) {
      return 0
    }
  }

  if (shorter.length < PREFIX_MATCH_MIN_SHARED_PARTS) {
    return 0
  }

  return Math.max(0, 100 - ((longer.length - shorter.length) * 10))
}

export function lookupModelsDevData(
  modelId: string,
  cache: Map<string, ModelsDevModel>
): ModelsDevModel | undefined {
  let cleanId = modelId.replace(/:[a-zA-Z0-9_-]+$/g, '')
  const parts = cleanId.split('/')
  if (parts.length > 2) {
    cleanId = parts.slice(-2).join('/')
  }

  const exactMatch = cache.get(cleanId) ?? cache.get(cleanId.toLowerCase())
  if (exactMatch) return exactMatch

  const requestedModelLower = splitModelId(cleanId).model.toLowerCase()
  const allCandidates: Array<[string, ModelsDevModel]> = []

  for (const [key, value] of cache.entries()) {
    const candidate = splitModelId(key)
    const candidateModelLower = candidate.model.toLowerCase()
    allCandidates.push([candidateModelLower, value])
  }

  const exactModelMatches = allCandidates.filter(([candidateModel]) => candidateModel === requestedModelLower)
  if (exactModelMatches.length === 1) return exactModelMatches[0]?.[1]
  if (exactModelMatches.length > 1) return undefined

  let bestMatch: ModelsDevModel | undefined
  let bestScore = 0
  let bestScoreMatches = 0

  for (const [candidateModel, value] of allCandidates) {
    const score = calculatePrefixScore(requestedModelLower, candidateModel)
    if (score >= PREFIX_MATCH_MIN_SCORE && score > bestScore) {
      bestScore = score
      bestMatch = value
      bestScoreMatches = 1
    } else if (score >= PREFIX_MATCH_MIN_SCORE && score === bestScore) {
      bestScoreMatches++
    }
  }

  return bestScoreMatches === 1 ? bestMatch : undefined
}

export const modelsDevTestUtils = {
  parseModelsDevData,
  resetCache(): void {
    modelsDevCaches.clear()
  },
}
