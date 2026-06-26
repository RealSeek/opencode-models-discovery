import type { ValidationResult } from './validation-result'

export function validateHookInput(hookName: string, input: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!input || typeof input !== 'object') {
    errors.push(`${hookName}: Input must be an object`)
    return { isValid: false, errors, warnings }
  }

  switch (hookName) {
    case 'config':
      // Config hook validation is handled by validateConfig
      break

    case 'event':
      if (!input.event || typeof input.event !== 'object') {
        errors.push('event: event is required and must be an object')
      } else if (!input.event.type) {
        warnings.push('event: event.type is missing')
      }
      break
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
