# GitHub Actions Setup Complete ✅

The tree-sitter-stlcpp repository now has automated CI/CD for Zed extension compatibility.

## What Was Created

### GitHub Actions Workflows

1. **`.github/workflows/test.yml`**
   - Runs on every push and PR
   - Validates grammar builds with Nix
   - Runs test suite
   - Reports failures early

2. **`.github/workflows/publish-zed-release.yml`**
   - Runs on push to `main` branch
   - Generates `src/` directory with `tree-sitter generate`
   - Commits to `zed-release` branch
   - Provides commit SHA for Zed extensions

### Documentation

- **`.github/workflows/README.md`** - Workflow documentation
- **`.github/TESTING.md`** - Local testing guide
- Updated **`README.md`** - Added Zed usage section
- Updated **`CLAUDE.md`** - Added publishing workflow for agents

### Branch Strategy

```
main (development)
├── grammar.js (source of truth)
├── package.nix (Nix build)
├── test/ (test fixtures)
└── src/ (gitignored - build artifact)

zed-release (publishing)
├── grammar.js (synced from main)
├── package.nix (synced from main)
├── test/ (synced from main)
└── src/ (committed - for Zed)
    ├── parser.c
    ├── grammar.json
    └── node-types.json
```

## Next Steps

### 1. Test Locally (Optional)

```bash
# Test the workflows work
nix-build -A packages.tree-sitter-stlcpp

# Verify tests pass
./test/test.sh
```

### 2. Commit and Push

```bash
git add .github/ README.md CLAUDE.md
git commit -m "Add GitHub Actions for automated Zed release publishing"
git push origin main
```

### 3. Watch the Workflow

Visit: `https://github.com/aalto-opencs/tree-sitter-stlcpp/actions`

The workflow will:
1. ✅ Build the grammar
2. ✅ Run tests
3. ✅ Generate `src/` files
4. ✅ Create/update `zed-release` branch
5. ✅ Provide commit SHA in summary

### 4. Update Zed Extension

After the workflow succeeds, get the `zed-release` commit SHA:

```bash
# Get the latest zed-release commit
git ls-remote https://github.com/aalto-opencs/tree-sitter-stlcpp refs/heads/zed-release

# Or check the GitHub Actions summary page
```

Update `../stlcpp-zed/extension.toml`:

```toml
[grammars.stlcpp]
repository = "https://github.com/aalto-opencs/tree-sitter-stlcpp"
rev = "abc123..."  # Use the zed-release commit SHA
```

### 5. Test in Zed

```bash
cd ../stlcpp-zed
# Update extension.toml as shown above
git add extension.toml
git commit -m "Update grammar to zed-release@abc123"
git push

# In Zed: Extensions -> Reload Extensions
# Or restart Zed
```

## Troubleshooting

### Workflow fails at "Generate parser files"

**Cause:** Node.js installation or tree-sitter CLI issue

**Fix:** The workflow installs Node.js and tree-sitter CLI automatically. Check the logs for specific errors.

### Workflow fails at "Commit to zed-release branch"

**Cause:** Git configuration or permission issues

**Fix:** Ensure the `GITHUB_TOKEN` has write permissions. This should be automatic for repos you own.

### Zed still can't find `src/parser.c`

**Cause:** Extension is pointing to wrong branch or commit

**Fix:**
1. Verify `extension.toml` uses `rev` from `zed-release` branch
2. Check the branch exists: `git ls-remote origin zed-release`
3. Verify `src/` exists on that branch

### "No changes to commit" in workflow

**Cause:** The `src/` files are already up-to-date on `zed-release`

**Fix:** This is normal! It means the grammar hasn't changed. No action needed.

## Benefits

✅ **Clean main branch** - No generated files cluttering git history
✅ **Automated publishing** - Push to main, CI handles the rest
✅ **Always valid** - Tests run before publishing
✅ **Easy rollback** - Each commit on zed-release links to main
✅ **Clear history** - See what grammar changes triggered what releases

## Architecture

```
Developer pushes to main
         ↓
   GitHub Actions CI
         ↓
    ┌─────────┬─────────┐
    ↓         ↓         ↓
Test Suite  Nix Build  tree-sitter generate
    ↓         ↓         ↓
   PASS      SUCCESS   src/ created
         ↓
  Commit to zed-release
         ↓
    Zed Extension
  (downloads, compiles to WASM)
```

## Questions?

- Check `.github/workflows/README.md` for workflow details
- Check `.github/TESTING.md` for local testing
- Check GitHub Actions logs for failures
- File issues on the repository

---

**Ready to go!** Push to `main` and watch the automation work. 🚀
