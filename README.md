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
- Type constructors:
  - `List T`, `IO T`
- Universal quantification:
  - `forall T, TypeExpr`
- Right-associative arrows:
  - `A -> B -> C`

## Comment syntax

**Only line comments are supported:**

- `// ...`

This matches the upstream STLC++ parser (there are no `--` comments).

## Generated files and publishing

Many consumers (including Zed’s grammar build pipeline) expect the grammar repository to include **generated C sources** under `src/`, especially:

- `src/parser.c`
- `src/node-types.json`
- `src/grammar.json`

These files are generated from `grammar.js` via the Tree-sitter CLI:

- `tree-sitter generate`

For a publishable grammar repo, keep the generated files committed so downstream consumers can build without additional steps.

## Queries

This repo includes Tree-sitter query files under `queries/` (e.g. `queries/highlights.scm`).

Important rules for editor integrations:
- Queries must only reference node types that actually exist in the compiled grammar.
- Avoid literal-token patterns in queries when targeting Zed; prefer named token nodes such as `(equals)`, `(lparen)`, `(rparen)`, etc.

## Local development notes

Typical workflow:

1. Edit `grammar.js`
2. Run `tree-sitter generate`
3. Validate:
   - `tree-sitter parse <file.stlc>`
   - `tree-sitter test` (if you maintain corpus tests)
4. Commit changes (including regenerated `src/*`)
5. Update the Zed extension’s pinned grammar revision (`extension.toml`) to the new commit SHA.

## Upstream references

- Upstream STLC++ implementation and parser: https://github.com/aalto-opencs/stlcpp
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/