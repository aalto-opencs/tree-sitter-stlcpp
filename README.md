# tree-sitter-stlcpp

This directory contains a **Tree-sitter grammar** for **STLC++** (called `stlcpp` in this repo). It is primarily intended to be consumed by the Zed extension in the parent repository (`stlcpp-zed/`).

The grammar is designed for **editor use**:
- stable parsing (minimize cascading `ERROR` nodes)
- explicit named nodes for punctuation/operators (to support robust highlighting without literal-token queries)
- a pragmatic approximation of the upstream grammar to keep Zed features usable

## Supported syntax (pragmatic subset)

This grammar aims to follow the upstream STLC++ surface syntax (see the upstream `nom` parser in `aalto-opencs/stlcpp`), including:

### Module / top-level forms
- Value declarations:
  - `x : Type`
  - `x = term`
  - Common pattern:
    - `main : Int`
    - `main = ...`
  - In this Tree-sitter grammar, these may be represented as a single `declaration` node with an optional embedded definition.
- Type alias declarations:
  - `State : Type`
  - `State = <type>`

- Import statements:
  - `import a.b` (module paths are parsed as term identifiers in this editor grammar)

- Custom syntax declarations:
  - `infixl`, `infixr`, `prefix` (as used by upstream syntax extensions)

### Terms
- Variables / identifiers:
  - term identifiers start with lowercase and may contain `.`, `_`, `'`
- Literals:
  - integers (decimal)
  - booleans: `true`, `false`
  - unit: `()`
  - character literals and string literals (with upstream-style escapes, including `\u{...}`)
- Let:
  - `let x = t in u`
- If:
  - `if t then u else v`
- Functions:
  - term abstraction: `fun x : T, t`
  - type abstraction: `fun T, t` (with optional sort annotation)
- Sums:
  - injections: `inl t T`, `inr t T`
  - case: `case t of | inl x => u | inr y => v` (optional braces supported)
- Lists:
  - `nil T`
  - list literals: `[t1, t2, ... : Type]`
  - list case: `lcase t of | nil => u | cons x xs => v` (optional braces supported)
- Applications:
  - `f x y` (application chains)
- Custom symbolic operators:
  - tokenized similarly to upstream “symbolic” operators, excluding structural punctuation
  - `=` is treated as structural and is **not** a custom operator

### Types
- Named types / variables (uppercase-initial) and `_` hole type
- Parenthesized types and products:
  - `(T)`
  - `(A, B)`
- List type sugar:
  - `[T]`
- Sum types (left-associative):
  - `A + B`
  - `[Char] + (Unit, [Char])`
- Type constructors:
  - `List T`, `IO T`
- Universal quantification:
  - `forall T, TypeExpr`
- Right-associative arrows:
  - `A -> B -> C`
  - Note: `A -> B + C -> D` parses as `A -> (B + C) -> D` (arrow binds looser than sum)

## Comment syntax

**Only line comments are supported:**

- `// ...`

This matches the upstream STLC++ parser (there are no `--` comments).

## Generated files

The C parser and metadata files under `src/` are **build artifacts** generated from `grammar.js`:

- `src/parser.c` - Generated C parser implementation
- `src/node-types.json` - Node type definitions
- `src/grammar.json` - Compiled grammar metadata

These files are **not checked into the repository**. They are generated during the build process via:

```bash
tree-sitter generate
```

The `package.nix` automatically runs `tree-sitter generate` during the build, so no pre-generated files are needed.

## Queries

This repo includes Tree-sitter query files under `queries/` (e.g. `queries/highlights.scm`).

Important rules for editor integrations:
- Queries must only reference node types that actually exist in the compiled grammar.
- Avoid literal-token patterns in queries when targeting Zed; prefer named token nodes such as `(equals)`, `(lparen)`, `(rparen)`, etc.

## Building with Nix

A `package.nix` is provided for building the grammar with Nix:

```bash
nix-build -A packages.tree-sitter-stlcpp
```

The Nix package compiles the C parser and installs:
- Shared library (`parser.so`)
- Grammar metadata files for tooling
- Runs test suite during build (see Testing below)

## Using in Zed Extensions

**For Zed extensions**, use the `zed-release` branch which includes generated `src/` files:

```toml
[grammars.stlcpp]
repository = "https://github.com/aalto-opencs/tree-sitter-stlcpp"
rev = "xxx"  # Use a commit SHA from the zed-release branch
```

The `zed-release` branch is automatically maintained by GitHub Actions and contains:
- All source files from `main` (`grammar.js`, etc.)
- Generated parser files (`src/parser.c`, `src/grammar.json`, etc.)

**Why two branches?**
- **`main`**: Clean development - `src/` is a build artifact (gitignored)
- **`zed-release`**: Publishing - `src/` committed for Zed's build process

See `.github/workflows/README.md` for details on the automated publishing process.

## Testing

The `test/` directory contains a test suite with fixtures:

- **`test/fixtures/`** - Examples that parse without errors (used in CI/builds)
  - `basic_declaration.stlc` - Type declarations and value definitions
  - `sum_types.stlc` - Sum types (`A + B`) and case analysis
  - `list_case.stlc` - List case expressions with `nil`/`cons` patterns

- **`test/fixtures-wip/`** - Examples with known parsing issues
  - Multi-line function applications
  - Complex operator patterns
  - See `test/fixtures-wip/README.md` for details

Run the test suite:
```bash
./test/test.sh
```

All tests in `fixtures/` must pass. The `fixtures-wip/` directory tracks progress on remaining grammar limitations.

## Local development notes

Typical workflow:

1. Edit `grammar.js`
2. Run `tree-sitter generate` (generates `src/` directory locally)
3. Validate:
   - `tree-sitter parse <file.stlc>`
   - `./test/test.sh` (run test suite)
4. Commit only `grammar.js` changes (not `src/` - it's gitignored)
5. Update the Zed extension's pinned grammar revision (`extension.toml`) to the new commit SHA.

**Note:** The `src/` directory is generated locally for development but is not committed to the repository. The Nix build and CI will generate it automatically from `grammar.js`.

## Upstream references

- Upstream STLC++ implementation and parser: https://github.com/aalto-opencs/stlcpp
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/