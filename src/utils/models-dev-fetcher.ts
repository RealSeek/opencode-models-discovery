interface ModelsDevModel {
  id: string
  name?: string
  family?: string
  attachment?: boolean
  reasoning?: boolean
  tool_call?: boolean
  structured_output?: boolean
  temperature?: boolean
  knowledge?: string | null
  release_date?: string
  last_updated?: string
  modalities?: {
    input?: string[]
    output?: string[]
  }
  open_weights?: boolean
  weights?: Array<{
    label: string
    url: string
  }> | null
  benchmarks?: Array<{
    name: string
    score: number
    metric: string
    harness?: string
    source: string
  }> | null
  pricing?: {
    input?: number
    output?: number
    currency?: string
  } | null
  limit?: {
    context?: number
    input?: number
    output?: number
  }
}

let modelsDevCache: Map<string, ModelsDevModel> | null = null

export async function fetchModelsDevData(): Promise<Map<string, ModelsDevModel>> {
  if (modelsDevCache) return modelsDevCache

  try {
    const response = await (globalThis as any).fetch('https://models.dev/models.json')

    if (!response.ok) {
      return new Map()
    }

    const data = await response.json() as Record<string, ModelsDevModel>
    
    modelsDevCache = new Map()
    for (const [, model] of Object.entries(data)) {
      if (model.id) {
        modelsDevCache.set(model.id, model)
      }
    }

    return modelsDevCache
  } catch {
    return new Map()
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
  
  const extraParts = longer.length - shorter.length
  return Math.max(0, 100 - (extraParts * 10))
}

export function lookupModelsDevData(
  modelId: string,
  cache: Map<string, ModelsDevModel>
): ModelsDevModel | undefined {
  
  // Level 1: Exact match
  if (cache.has(modelId)) return cache.get(modelId)
  
  // Parse LiteLLM model ID
  const parts = modelId.split('/')
  const litellmProvider = parts.length > 1 ? parts[0] : null
  const litellmModel = parts.length > 1 ? parts[1] : parts[0]
  
  // Level 2: Provider + Model match
  if (litellmProvider) {
    for (const [key, value] of cache.entries()) {
      const devParts = key.split('/')
      if (devParts.length > 1) {
        const devProvider = devParts[0]
        const devModel = devParts[1]
        
        if (devProvider === litellmProvider && devModel === litellmModel) {
          return value
        }
      }
    }
  }
  
  // Level 3: Model name only (ignore provider)
  const modelNameLower = litellmModel.toLowerCase()
  
  for (const [key, value] of cache.entries()) {
    const devModel = key.split('/').pop()!.toLowerCase()
    
    if (modelNameLower === devModel) {
      return value
    }
  }
  
  // Level 4: Prefix-based matching with score
  let bestMatch: ModelsDevModel | undefined
  let bestScore = 0
  
  for (const [key, value] of cache.entries()) {
    const devModel = key.split('/').pop()!.toLowerCase()
    const score = calculatePrefixScore(modelNameLower, devModel)
    
    if (score > bestScore) {
      bestScore = score
      bestMatch = value
    }
  }
  
  return bestMatch
}

export type { ModelsDevModel }
