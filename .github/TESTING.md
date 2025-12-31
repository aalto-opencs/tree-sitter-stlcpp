# Testing GitHub Actions Workflows Locally

Before pushing workflows to GitHub, you can test them locally to catch issues early.

## Prerequisites

```bash
# Install act (GitHub Actions local runner)
# On NixOS/with Nix:
nix-shell -p act

# Or with homebrew (macOS):
brew install act

# Or download from: https://github.com/nektos/act
```

## Testing the Workflows

### Test the build workflow

```bash
# Test on push event (default)
act push -j test

# This will:
# - Install Nix in the container
# - Build the grammar
# - Run tests
```

### Test the publish workflow (dry run)

```bash
# Test the zed-release publish workflow
# Note: This won't actually push (no credentials in local run)
act push -j build-and-publish -e .github/test-event.json
```

Create `.github/test-event.json`:
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "owner": {
      "login": "aalto-opencs"
    },
    "name": "tree-sitter-stlcpp"
  }
}
```

## What to Look For

✅ **Success indicators:**
- Nix installs without errors
- `nix-build` completes successfully
- `tree-sitter generate` creates `src/parser.c`
- All test fixtures pass
- Git operations complete (even if push fails locally)

❌ **Common issues:**
- Container out of disk space (act uses Docker)
- Missing dependencies (should be in Nix derivation)
- Permission issues with git operations
- Path issues with file locations

## Testing on GitHub

After local testing, push a test branch:

```bash
git checkout -b test-workflows
git add .github/
git commit -m "Add CI workflows"
git push origin test-workflows
```

Watch the workflow runs at:
`https://github.com/aalto-opencs/tree-sitter-stlcpp/actions`

## Manual Testing of the Generated Branch

After the workflow runs successfully:

```bash
# Fetch the zed-release branch
git fetch origin zed-release

# Check it out
git checkout zed-release

# Verify src/ exists
ls -la src/
cat src/parser.c | head -20

# Verify it's valid C code
file src/parser.c
```

The `zed-release` branch should have:
- All files from main (`grammar.js`, `package.nix`, etc.)
- Generated `src/` directory with `parser.c`, `grammar.json`, `node-types.json`
- Modified `.gitignore` (src/ is not ignored on this branch)

## Updating Zed Extension

Once the workflow succeeds, update your Zed extension:

```bash
cd ../stlcpp-zed

# Get the commit SHA from zed-release
COMMIT_SHA=$(git ls-remote https://github.com/aalto-opencs/tree-sitter-stlcpp refs/heads/zed-release | cut -f1)

# Update extension.toml
sed -i "s/rev = \".*\"/rev = \"$COMMIT_SHA\"/" extension.toml

# Commit and push
git add extension.toml
git commit -m "Update tree-sitter-stlcpp to zed-release@${COMMIT_SHA:0:7}"
git push
```

Then rebuild the extension in Zed!
