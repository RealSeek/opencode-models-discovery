export { formatModelName, extractModelOwner } from './format-model-name'

// Only embedding models need special handling; every other discovered model
// receives the chat defaults unless richer provider metadata says otherwise.
export function categorizeModel(modelId: string): 'chat' | 'embedding' | 'unknown' {
  const lowerId = modelId.toLowerCase()
  if (lowerId.includes('embedding') || lowerId.includes('embed')) {
    return 'embedding'
  }
  return 'chat'
}
