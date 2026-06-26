# Configuration Guide

This plugin discovers models for OpenAI-compatible providers and merges them into the active OpenCode config at startup.

For new setups, use `provider.<name>.options.modelsDiscovery` for provider-specific behavior. This keeps discovery rules close to the provider they affect and avoids older global rules unintentionally changing newer providers.

OpenCode's own provider config still controls provider identity, npm package, `baseURL`, credentials, and provider availability. This plugin controls model discovery for providers that OpenCode has made available.

## Provider-Level Configuration

Each provider can configure discovery behavior through `provider.<name>.options.modelsDiscovery`:

```json
{
  "plugin": ["opencode-models-discovery"],
  "provider": {
    "lmstudio": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio",
      "options": {
        "baseURL": "http://127.0.0.1:1234/v1",
        "modelsDiscovery": {
          "enabled": true,
          "models": {
            "includeRegex": ["^llama"]
          },
          "smartModelName": true
        }
      }
    }
  }
}
```

| Option | Type | Description |
|--------|------|-------------|
| `provider.<name>.options.modelsDiscovery.enabled` | `boolean` | Force enable or disable discovery for a single provider |
| `provider.<name>.options.modelsDiscovery.endpoint` | `string` | Provider-specific models endpoint path. Defaults to `/v1/models` |
| `provider.<name>.options.modelsDiscovery.modelInfoEndpoint` | `string` | Provider-specific model info endpoint path. Metadata enrichment is disabled when omitted |
| `provider.<name>.options.modelsDiscovery.modelInfoFormat` | `string` | Model info response format. Currently supports `"litellm"` and `"models.dev"` |
| `provider.<name>.options.modelsDiscovery.filterNonChat` | `boolean` | When model info is available, skip models whose `model_info.mode` is not `chat`. Defaults to `true` |
| `provider.<name>.options.modelsDiscovery.models.includeRegex` | `string[]` | Provider-specific model include filter |
| `provider.<name>.options.modelsDiscovery.models.excludeRegex` | `string[]` | Provider-specific model exclude filter |
| `provider.<name>.options.modelsDiscovery.smartModelName` | `boolean` | Use human-friendly display names instead of raw discovered model ids |

Recommended approach:

1. Keep the plugin entry simple: `"plugin": ["opencode-models-discovery"]`.
2. Put endpoint, enablement, and model filtering rules on each provider.
3. Use `modelsDiscovery.endpoint` whenever a provider does not follow the usual `/v1/models` convention.
4. Use OpenCode `/connect` credentials or `provider.<name>.options.apiKey` for secrets; do not duplicate API keys unless needed.

If `provider.<name>.options.modelsDiscovery.endpoint` is omitted, the plugin uses `/v1/models`.

## Priority Rules

1. `provider.<name>.options.modelsDiscovery.enabled = true` forces discovery for that provider.
2. `provider.<name>.options.modelsDiscovery.enabled = false` disables discovery for that provider.
3. If `enabled` is omitted, discovery follows the plugin default and compatibility detection.
4. If a provider defines `modelsDiscovery.models` filters, those filters apply only to that provider.
5. OpenCode `enabled_providers` and `disabled_providers` control whether providers are available at all. This plugin does not override those OpenCode provider availability settings.

## v0.12 Transition and v1.0 Compatibility

Version `0.12.x` still supports legacy plugin-level discovery configuration for compatibility, but new configuration should be provider-level. Plugin-level discovery options are planned for removal in `1.0.0`.

Legacy plugin-level options:

- `discovery.enabled`
- `providers.include`
- `providers.exclude`
- `models.includeRegex`
- `models.excludeRegex`
- `smartModelName`

When deprecated global config is detected, `0.12.x` logs a warning, shows a toast, and injects `/models-discovery:migrate` to guide migration.

Planned `1.0.0` behavior:

- Plugin-level discovery config is removed.
- Discovery remains enabled by default for compatible providers.
- `provider.<name>.options.modelsDiscovery.enabled = false` disables discovery for a specific provider.
- `OPENCODE_MODELS_DISCOVERY_DEFAULT_ENABLED=false` is planned for users who want providers without explicit config to default to disabled.

Use `/models-discovery:config` for assistant-guided provider-level setup. Use `/models-discovery:migrate` when `0.12.x` detects deprecated plugin-level config.

## Model Metadata Enrichment

The generic OpenAI-compatible `/v1/models` endpoint only guarantees a small model list shape. Extra metadata such as context limits, tool calling, reasoning, image input, or structured output is provider-specific, so metadata enrichment is opt-in.

The plugin currently supports two model info formats:

| Format | Source | Requires `modelInfoEndpoint` | Notes |
|--------|--------|------------------------------|-------|
| `"litellm"` | Provider-specific model info endpoint | Yes | Uses LiteLLM `/v1/model/info` responses |
| `"models.dev"` | `https://models.dev/models.json` | No | Uses the public models.dev metadata index |

### LiteLLM Model Info

LiteLLM exposes a richer `/v1/model/info` endpoint in addition to the OpenAI-compatible `/v1/models` endpoint.

Configure both `modelInfoEndpoint` and `modelInfoFormat` to enable it for a provider.

```json
{
  "plugin": ["opencode-models-discovery"],
  "provider": {
    "litellm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM",
      "options": {
        "baseURL": "http://127.0.0.1:4000/v1",
        "modelsDiscovery": {
          "enabled": true,
          "endpoint": "/v1/models",
          "modelInfoEndpoint": "/v1/model/info",
          "modelInfoFormat": "litellm"
        }
      },
      "models": {}
    }
  }
}
```

When model info is available, the plugin uses LiteLLM `model_info` fields to populate OpenCode model configuration:

- `max_input_tokens`, `max_output_tokens`, and `max_tokens` become `limit.context`, `limit.input`, and `limit.output`
- `supports_reasoning` enables `reasoning`
- `supports_*_reasoning_effort` and `supported_openai_params` create reasoning `variants`
- By default, entries whose `model_info.mode` is not `chat` are skipped

### models.dev Metadata

Use `modelInfoFormat: "models.dev"` to enrich discovered models from the public [models.dev](https://models.dev) metadata index.

This project is not affiliated with, endorsed by, or sponsored by [models.dev](https://models.dev/).

This does not require `modelInfoEndpoint`, because the source is fixed to `https://models.dev/models.json`:

```json
{
  "plugin": ["opencode-models-discovery"],
  "provider": {
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "YOUR_OPENROUTER_API_KEY",
        "modelsDiscovery": {
          "enabled": true,
          "modelInfoFormat": "models.dev"
        }
      },
      "models": {}
    }
  }
}
```

When a discovered model can be matched to models.dev metadata, the plugin may populate:

- `limit.context`, `limit.input`, and `limit.output`
- `attachment`
- `reasoning`
- `tool_call`
- `structured_output`
- `temperature`
- `modalities`

Matching is intentionally conservative:

- Exact model ids are preferred.
- Provider-qualified matches stay within the same provider.
- Model-only matches are used only when the discovered model id has no provider prefix.
- Prefix matching is limited to strong same-provider variants, such as date-suffixed model ids.

If models.dev cannot be fetched, or if no safe match is found, discovery still succeeds and the plugin leaves metadata fields unset. It does not inject hardcoded default context or output limits for unknown models.

Because this option makes a public network request to models.dev during discovery, it is disabled unless explicitly configured.

For providers with custom metadata paths or non-standard behavior:

```json
{
  "provider": {
    "custom": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://127.0.0.1:9000/v1",
        "modelsDiscovery": {
          "modelInfoEndpoint": "/custom/model-info",
          "modelInfoFormat": "litellm",
          "filterNonChat": false
        }
      }
    }
  }
}
```

## Example Configurations

### Mixed Providers

```json
{
  "plugin": ["opencode-models-discovery"],
  "provider": {
    "lmstudio": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio",
      "options": {
        "baseURL": "http://127.0.0.1:1234/v1",
        "modelsDiscovery": {
          "enabled": true,
          "endpoint": "/v1/models",
          "models": {
            "includeRegex": ["^gpt-"]
          },
          "smartModelName": true
        }
      },
      "models": {}
    },
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "sk-example-deepseek-key",
        "modelsDiscovery": {
          "enabled": true,
          "endpoint": "/models",
          "smartModelName": true
        }
      },
      "models": {}
    }
  }
}
```

In this example:

1. `lmstudio` explicitly enables discovery and uses the default `/v1/models` endpoint.
2. `lmstudio` limits discovery to models matching `^gpt-`.
3. `deepseek` explicitly enables discovery but uses `"/models"` instead of `/v1/models`.
4. The API key uses an example placeholder and should be replaced in real configs.

### Provider-First Style

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-models-discovery"],
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama",
      "options": {
        "baseURL": "http://127.0.0.1:11434/v1",
        "modelsDiscovery": {
          "enabled": true,
          "models": {
            "includeRegex": ["^qwen/"]
          }
        }
      }
    },
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "YOUR_DEEPSEEK_API_KEY",
        "modelsDiscovery": {
          "enabled": true,
          "endpoint": "/models",
          "smartModelName": true
        }
      }
    }
  }
}
```

In this example:

1. The plugin entry is simple and contains no legacy global discovery config.
2. `ollama` uses the default discovery path derived from its `/v1` baseURL.
3. `deepseek` does not rely on `/v1/models` and explicitly uses `"/models"`.
4. Each provider can evolve independently without changing global include or endpoint rules.

## Provider Filtering

For new configs, enable or disable discovery on the provider itself:

```json
{
  "provider": {
    "ollama": {
      "options": {
        "modelsDiscovery": {
          "enabled": true
        }
      }
    },
    "lmstudio": {
      "options": {
        "modelsDiscovery": {
          "enabled": false
        }
      }
    }
  }
}
```

Legacy plugin-level provider filters are still supported in `0.12.x`, but are deprecated:

| Option | Type | Description |
|--------|------|-------------|
| `providers.include` | `string[]` | If non-empty, only these providers will be discovered |
| `providers.exclude` | `string[]` | These providers will be skipped when `include` is empty |

```json
{
  "plugin": [
    ["opencode-models-discovery", {
      "providers": {
        "include": ["ollama"],
        "exclude": ["lmstudio"]
      }
    }]
  ]
}
```

## Model Filtering

Control which discovered models are auto-injected with provider-level regular expressions:

| Option | Type | Description |
|--------|------|-------------|
| `provider.<name>.options.modelsDiscovery.models.includeRegex` | `string[]` | If non-empty, only discovered model ids matching at least one regex will be added for this provider |
| `provider.<name>.options.modelsDiscovery.models.excludeRegex` | `string[]` | Discovered model ids matching any regex will be skipped for this provider |

Regex filtering only applies to auto-discovered models. Models already explicitly configured by the user are preserved.

```json
{
  "provider": {
    "ollama": {
      "options": {
        "modelsDiscovery": {
          "models": {
            "includeRegex": ["^qwen/", "gpt-4"],
            "excludeRegex": ["embedding", "test"]
          }
        }
      }
    }
  }
}
```

Legacy plugin-level model filters are still supported in `0.12.x`, but are deprecated.
