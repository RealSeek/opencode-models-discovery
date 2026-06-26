import type { PluginLogger } from './logger'

export const MIGRATION_COMMAND_NAME = 'models-discovery:migrate'
export const CONFIG_COMMAND_NAME = 'models-discovery:config'

export const MIGRATION_COMMAND_TEMPLATE = `Use the customize-opencode skill.

Migrate opencode-models-discovery legacy global configuration to provider-level configuration.

Inspect both:
- the project OpenCode config: opencode.json, opencode.jsonc, or .opencode/opencode.json under the current project/worktree
- the user global OpenCode config: ~/.config/opencode/opencode.json

If OPENCODE_CONFIG is set and points to a file, inspect that custom config file too.

Do not edit managed or organization-controlled config unless the user explicitly asks for it. Managed config locations are platform-specific, including /Library/Application Support/opencode/ on macOS, /etc/opencode/ on Linux, and %ProgramData%\\opencode on Windows.

Find the OpenCode config file that declares the opencode-models-discovery plugin and also contains legacy plugin-level options for that plugin.

Legacy opencode-models-discovery options are:
- discovery.enabled
- providers.include
- providers.exclude
- models.includeRegex
- models.excludeRegex
- smartModelName

Move these settings into provider.<id>.options.modelsDiscovery where possible.

Preserve unrelated config fields and formatting as much as possible.
Do not modify files that do not declare this plugin.
Do not guess provider IDs that are not present in editable config.
Do not overwrite existing provider.<id>.options.modelsDiscovery fields unless the user explicitly asks you to.
If migration cannot be done safely, explain what blocked it and show the exact manual changes needed.

For v1.0.0 behavior:
- plugin-level global discovery config is deprecated
- discovery remains enabled by default
- provider.<id>.options.modelsDiscovery.enabled=false disables discovery for that provider
- OPENCODE_MODELS_DISCOVERY_DEFAULT_ENABLED=false can be used later to make unspecified providers default to disabled

If providers.include is used, preserve the old opt-in behavior by either recommending OPENCODE_MODELS_DISCOVERY_DEFAULT_ENABLED=false with explicit enabled providers, or disabling known non-included editable providers with modelsDiscovery.enabled=false. Prefer explaining the environment variable approach instead of writing many disable entries unless the user asks for a pure config-only migration.

After editing config, remind the user to quit and restart opencode.`

export const CONFIG_COMMAND_TEMPLATE = `Use the customize-opencode skill.

Help configure opencode-models-discovery using the recommended provider-level configuration style.

Inspect both:
- the project OpenCode config: opencode.json, opencode.jsonc, or .opencode/opencode.json under the current project/worktree
- the user global OpenCode config: ~/.config/opencode/opencode.json

If OPENCODE_CONFIG is set and points to a file, inspect that custom config file too.

Do not edit managed or organization-controlled config unless the user explicitly asks for it. Managed config locations are platform-specific, including /Library/Application Support/opencode/ on macOS, /etc/opencode/ on Linux, and %ProgramData%\\opencode on Windows.

Find the OpenCode config file that declares the opencode-models-discovery plugin, or ask the user whether the plugin should be added to project or user global config if it is not configured yet.

Use provider-level configuration under provider.<id>.options.modelsDiscovery. Prefer this shape:

{
  "provider": {
    "<provider-id>": {
      "options": {
        "modelsDiscovery": {
          "enabled": true,
          "models": {
            "includeRegex": "...",
            "excludeRegex": "..."
          },
          "smartModelName": true,
          "modelInfoFormat": "models.dev"
        }
      }
    }
  }
}

Only include fields the user needs. Do not add placeholder regex values.

Recommended defaults:
- omit modelsDiscovery.enabled when the user is fine with discovery defaulting on
- set modelsDiscovery.enabled=false to disable discovery for a specific provider
- use models.includeRegex or models.excludeRegex only when the user wants model filtering
- use smartModelName=true only when the user wants friendlier display names
- use modelInfoFormat="models.dev" for models.dev metadata enrichment
- use modelInfoEndpoint and modelInfoFormat="litellm" for LiteLLM-compatible model info endpoints

Preserve unrelated config fields and formatting as much as possible.
Do not overwrite existing provider.<id>.options.modelsDiscovery fields unless the user explicitly asks you to.
After editing config, remind the user to quit and restart opencode.`

function ensureCommandConfig(config: any): Record<string, any> | undefined {
  if (!config || typeof config !== 'object') {
    return undefined
  }

  if (!config.command || typeof config.command !== 'object' || Array.isArray(config.command)) {
    config.command = {}
  }

  return config.command
}

function injectCommand(
  config: any,
  logger: PluginLogger,
  commandName: string,
  command: { description: string; agent: string; template: string },
  existingMessage: string
): void {
  const commands = ensureCommandConfig(config)
  if (!commands) {
    return
  }

  if (commands[commandName]) {
    logger.warn(existingMessage, {
      command: commandName,
    })
    return
  }

  commands[commandName] = command
}

export function injectMigrationCommand(config: any, logger: PluginLogger): void {
  injectCommand(
    config,
    logger,
    MIGRATION_COMMAND_NAME,
    {
      description: 'Migrate opencode-models-discovery config',
      agent: 'build',
      template: MIGRATION_COMMAND_TEMPLATE,
    },
    'Migration command already exists; leaving user-defined command unchanged'
  )
}

export function injectConfigCommand(config: any, logger: PluginLogger): void {
  injectCommand(
    config,
    logger,
    CONFIG_COMMAND_NAME,
    {
      description: 'Configure opencode-models-discovery',
      agent: 'build',
      template: CONFIG_COMMAND_TEMPLATE,
    },
    'Config command already exists; leaving user-defined command unchanged'
  )
}
