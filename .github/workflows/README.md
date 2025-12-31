# GitHub Actions Workflows

This directory contains CI/CD workflows for the tree-sitter-stlcpp grammar.

## Workflows

### `test.yml` - Continuous Testing

**Triggers:** Push, Pull Request, Manual

Runs on every push and pull request to verify the grammar builds correctly:
1. Installs Nix
2. Builds the grammar package with `nix-build -A packages.tree-sitter-stlcpp`
3. Runs all test fixtures
4. Reports build success/failure

This ensures that changes to `grammar.js` don't break the build.

### `publish-zed-release.yml` - Zed Extension Release

**Triggers:** Push to main branch, Manual

**Purpose:** Maintains a `zed-release` branch with generated `src/` files for Zed extension compatibility.

**What it does:**
1. Builds the grammar with Nix (validates the build)
2. Generates parser files (`tree-sitter generate` creates `src/parser.c`, etc.)
3. Commits the generated `src/` directory to the `zed-release` branch
4. Provides the commit SHA for updating Zed extensions

**Why this is needed:**

Zed extensions need the generated C parser (`src/parser.c`) to compile grammars to WASM. Our main branch treats `src/` as a build artifact (gitignored), but Zed expects it in the repository.

The `zed-release` branch is a publishing branch that includes these generated files, allowing Zed to build the grammar while keeping the main branch clean.

## Using the Workflows

### For Development
Just push to any branch - the test workflow will validate your changes.

### For Zed Extensions
When the workflow completes, check the summary for the commit SHA to use in your `extension.toml`:

```toml
[grammars.stlcpp]
repository = "https://github.com/your-org/tree-sitter-stlcpp"
rev = "abc123..."  # Use the SHA from zed-release branch
```

## Branch Strategy

- **`main`** - Source of truth, `src/` is gitignored, built via Nix
- **`zed-release`** - Publishing branch with `src/` committed for Zed

Never commit directly to `zed-release` - it's managed by GitHub Actions.
