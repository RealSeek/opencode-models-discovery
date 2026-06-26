# Upgrading

## v0.12 Transition Release

Version `0.12.x` is a compatibility transition for the provider-level configuration model.

Existing plugin-level discovery config continues to work in `0.12.x`, but it is deprecated:

- `discovery.enabled`
- `providers.include`
- `providers.exclude`
- `models.includeRegex`
- `models.excludeRegex`
- `smartModelName`

When deprecated config is detected, the plugin logs a warning, shows a migration toast, and injects `/models-discovery:migrate` into OpenCode's command list.

For new or updated configs, prefer `provider.<name>.options.modelsDiscovery`.

## v1.0 Compatibility Boundary

The planned `1.0.0` compatibility boundary is provider-level discovery config.

Expected `1.0.0` behavior:

- Plugin-level discovery config is removed.
- Discovery remains enabled by default for compatible providers.
- `provider.<name>.options.modelsDiscovery.enabled = false` disables discovery for one provider.
- `OPENCODE_MODELS_DISCOVERY_DEFAULT_ENABLED=false` is planned for users who want providers without explicit config to default to disabled.

Use `/models-discovery:config` to get assistant-guided provider-level configuration help. Use `/models-discovery:migrate` to migrate deprecated plugin-level config when it is detected.

## Refresh Plugin Cache After Upgrade

If you upgrade `opencode-models-discovery` and OpenCode still behaves like it is using an older version, refresh the OpenCode plugin cache and restart OpenCode.

This is worth checking when:

- a newly released feature does not appear after upgrading
- behavior still matches an older plugin build
- issue fixes seem not to have taken effect locally

OpenCode may continue using a cached plugin package even after the npm package has been updated.

## Recommended Upgrade Checklist

1. Upgrade the npm package version you use.
2. Restart OpenCode.
3. If behavior still looks stale, refresh the OpenCode plugin cache.
4. Start OpenCode again and verify the plugin version now matches the expected build.

## When This Matters Most

This is especially relevant after upgrades that change startup-time behavior, such as:

- model discovery behavior
- `/connect` credential discovery
- provider-specific discovery endpoints
- model filtering or metadata enrichment
