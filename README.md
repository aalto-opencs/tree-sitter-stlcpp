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

The C parser and metadata files under `src/` are generated from `grammar.js`:

- `src/parser.c` - Generated C parser implementation
- `src/node-types.json` - Node type definitions
- `src/grammar.json` - Compiled grammar metadata

These files are **checked into the repository** for convenience and to support direct use by editor extensions.

To regenerate after editing `grammar.js`:

```bash
tree-sitter generate
```

Then commit the updated `src/` files along with your `grammar.js` changes.

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

**For Zed extensions**, reference this repository directly:

```toml
[grammars.stlcpp]
repository = "https://github.com/aalto-opencs/tree-sitter-stlcpp"
rev = "xxx"  # Use a commit SHA from the main branch
```

The repository includes all necessary files for Zed's build process:
- Source grammar (`grammar.js`)
- Generated parser files (`src/parser.c`, `src/grammar.json`, `src/node-types.json`)
- Query files (`queries/highlights.scm`, etc.)

## Testing

The `test/` directory contains comprehensive tests using tree-sitter's standard corpus format:

The test suite in `test/corpus/` uses tree-sitter's standard corpus format:

- **53 test cases** covering all major language features
- Tests verify both parsing and AST structure
- Organized by feature: applications, functions, types, operators, etc.

Run tests:
```bash
tree-sitter test
```

Update expected trees after grammar changes:
```bash
tree-sitter test --update
```

Manual testing with upstream examples:
```bash
# Parse a specific file
tree-sitter parse ../stlcpp/examples/var.stlc

# Test all upstream examples
for file in ../stlcpp/examples/*.stlc; do
  tree-sitter parse "$file" 2>&1 | grep -q ERROR && echo "✗ $file" || echo "✓ $file"
done
```

See `test/README.md` for complete testing documentation.

## Local development notes

Typical workflow:

1. Edit `grammar.js`
2. Run `tree-sitter generate` to regenerate `src/` files
3. Validate:
   - `tree-sitter test` (run all 53 corpus tests)
   - `tree-sitter parse <file.stlc>` (inspect parse tree for specific files)
   - Test upstream examples if making significant changes
4. Update corpus tests if needed: `tree-sitter test --update`
5. Commit your changes:
   - `grammar.js` (your grammar edits)
   - `src/` (regenerated parser files)
   - `test/corpus/` (if tests were added/updated)
6. Push to `main`

**Note:** Always run `tree-sitter generate` and commit the updated `src/` files when you modify `grammar.js`. This ensures the repository stays in sync.

## Upstream references

- Upstream STLC++ implementation and parser: https://github.com/aalto-opencs/stlcpp
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/