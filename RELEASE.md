# Release Process

This fork publishes `@realseek/opencode-models-discovery` through GitHub Actions. The Publish workflow is manually triggered after a version bump and npm trusted publishing is configured.

## Quick Start

1. Merge ready feature changes into `main`.
2. Bump `package.json` and `package-lock.json` to a new version.
3. Configure npm trusted publishing for `RealSeek/opencode-models-discovery` and `publish.yml`.
4. Run the GitHub Actions `Publish` workflow manually.
5. Verify the generated tag, GitHub release, and npm package.

## Branch Flow

```text
feature branches -> main -> publish
```

Release branches are short-lived per-version branches. There is no long-lived `release` branch.

## What the Workflows Do

### Release Workflow

The Release workflow (`.github/workflows/release.yml`) is manually triggered. It checks out `main` by default and runs:

```bash
bun scripts/release.ts prepare <patch|minor|major>
```

It will:

1. Create `release/vX.Y.Z` from the selected source branch.
2. Bump `package.json` to `X.Y.Z`.
3. Run `npm run build`.
4. Commit the version bump.
5. Push the release branch.
6. Open a PR from `release/vX.Y.Z` to `main`.

### Publish Workflow

The Publish workflow (`.github/workflows/publish.yml`) runs only on manual dispatch. It runs:

```bash
bun scripts/release.ts publish
```

It will:

1. Run `npm run build`.
2. Create and push the `vX.Y.Z` git tag if it does not already exist.
3. Create a GitHub release with generated release notes.
4. Publish `@realseek/opencode-models-discovery@X.Y.Z` to npm if that version does not already exist.

## Prerequisites

### Local Releases

Local release preparation can still use the same script, but prefer the GitHub Actions workflow for normal releases.

1. **GitHub CLI** (`gh`) authenticated:
   - `gh auth login`

2. From the intended source branch, run:

```bash
bun scripts/release.ts prepare patch
```

### CI/CD Releases (GitHub Actions)

1. Configure npm trusted publishing for this repository.
2. Ensure the Publish workflow has `id-token: write` permission.
3. Run the workflow:
   - Go to: Actions -> Publish -> Run workflow
   - Click "Run workflow"

## Version Types

- **patch**: Bug fixes, small improvements (0.1.0 -> 0.1.1)
- **minor**: New features, backwards compatible (0.1.0 -> 0.2.0)
- **major**: Breaking changes (0.1.0 -> 1.0.0)

## Manual Steps (if needed)

If automation fails, complete the same two phases manually.

### Prepare Release PR

```bash
git switch main
bun scripts/release.ts prepare patch
```

### Publish After Merge

```bash
git switch main
git pull origin main
bun scripts/release.ts publish
```

## Troubleshooting

### npm publish fails

Common causes:

- Trusted Publishing is not configured for this repository.
- The Publish workflow is missing `id-token: write`.
- The package version already exists on npm.
- The publish step was run outside GitHub Actions without npm credentials.

### GitHub release creation fails

Ensure `GH_TOKEN` is available in GitHub Actions, or authenticate GitHub CLI locally:

```bash
gh auth login
```

### Version already exists

The publish script detects existing npm versions and skips `npm publish`. Bump to a new version if you need another release.

## CI/CD Integration

The normal CI/CD release path is:

1. Go to Actions tab.
2. Select `Publish` workflow.
3. Click `Run workflow`.
4. Run Publish manually after a version bump.
5. Verify the npm package and GitHub release.

The first public scoped-package publish uses `--access public` through `package.json.publishConfig`.
