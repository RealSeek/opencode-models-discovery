import { validateHookInput } from '../utils/validation'
import { isToastReadyEvent, type LegacyGlobalConfigWarningController } from './legacy-config-warning'
import { ToastNotifier } from '../ui/toast-notifier'
import type { PluginLogger } from './logger'

export function createEventHook(
  toastNotifier: ToastNotifier,
  legacyGlobalConfigWarning: LegacyGlobalConfigWarningController,
  logger: PluginLogger
) {
  return async ({ event }: { event: any }) => {
    const validation = validateHookInput('event', { event })
    if (!validation.isValid) {
      logger.error('Invalid event input', { errors: validation.errors })
      return
    }

    if (isToastReadyEvent(event)) {
      legacyGlobalConfigWarning.startRetries(toastNotifier)
      return
    }

    if (event.type === "session.created" || event.type === "session.updated") {
      // Reserved for future session-aware discovery diagnostics.
    }
  }
}
