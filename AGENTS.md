# AGENT instructions — working with the tree-sitter-stlcpp repository

This document is written for automated assistants (Claude-style agents, bots, or other AI helpers) that will make focused edits and tests in this repository. Use this as a quick onboarding checklist and a set of conventions & patterns that keep the grammar stable and easy to maintain.

High-level goals
- Maintain a correct Tree-sitter grammar for the STLC++ language.
- Keep generated artifacts in sync with edits to the source grammar.
- Prefer small, targeted grammar changes that avoid introducing ambiguous or empty-match productions.
- Mirror upstream parser semantics (Rust/nom implementation) where useful, especially for keywords and builtin names.

Repository layout (important files)
- `grammar.js` — the single source-of-truth Tree-sitter grammar (JavaScript DSL). Edit this file. **This is the only source file committed to the repo.**
- `src/` — generated directory (NOT in git). Contains `parser.c`, `grammar.json`, `node-types.json` created by `tree-sitter generate`.
  - `src/parser.c` — generated C parser implementation; don't edit this manually.
  - `src/grammar.json` — generated; represents the compiled grammar.
  - `src/node-types.json` — generated; contains node naming metadata used by editors & highlight rules.
- `queries/highlights.scm` — optional highlight queries (may or may not exist); keep them in sync with node names.
- `test/fixtures/` — test cases that must parse without ERROR nodes.
- `test/fixtures-wip/` — examples with known parsing issues (for tracking improvements).
- `../stlcpp/examples/` — (upstream examples) used for testing examples parsing.

Basic workflow (edit → generate → test)
1. Read and understand `grammar.js`.
   - Always open `grammar.js` first to find the rule(s) you intend to change.
   - Search the repo for the symbol you plan to edit (prefer text search in `grammar.js` and then narrow to `src/` outputs).
2. Make a minimal, well-reasoned change in `grammar.js`.
   - Avoid large refactors in a single PR. Small iterative edits are easier to validate.
3. Run the grammar generator to update `src/*` artifacts.
   - Run: `tree-sitter generate` from the repository root.
   - If generation fails, read the error (generator errors are usually explicit).
4. Test parsing on sample files, especially upstream examples:
   - Run: `tree-sitter parse PATH_TO_EXAMPLE` (e.g. `tree-sitter parse ../stlcpp/examples/var.stlc`).
   - If the parse output contains `ERROR` nodes, inspect the printed tree to find where a token or rule was not accepted.
5. Iterate until the example parses without ERROR nodes. When stable, commit your grammar edit and the regenerated artifacts.

Common generator pitfalls and grammar rules of thumb
- Never create a rule that can match the empty string except for the start rule. The generator will reject such rules.
  - Use `repeat1(...)` when you must accept one-or-more items (e.g. whitespace/newline sequences).
  - Avoid `repeat(...)` alone in helpers that are inserted with `optional(...)` or `seq(optional(helper), rule)` — this can cause empty-match problems.
- `extras` vs explicit newline/comment tokens:
  - The grammar in this repo treats horizontal whitespace (` `, `\t`, `\f`, `\r`) as `extras`, but keeps `newline` and `comment` as explicit tokens in many places.
  - This design prevents inner constructs from crossing blank/comment-only lines and helps avoid EOF/trailing-trivia `ERROR` nodes. If you change this design, search for and update the small set of rules that need explicit newline handling.
- Prefer local allowances for newlines/comments (e.g. `maybe_expr`) over making them global trivia when you want to accept a value on the next line. If you add such helpers:
  - Implement them as a choice between `X` and `seq(repeat1(choice($.newline, $.comment)), X)` so they don't match the empty string.
- Keep `prec`, `prec.left`, `prec.right`, and `conflicts` small and local:
  - Use precedence (`PREC.*`) to guide ambiguous LR shifts where appropriate (applications, infix, assignment).
  - If Tree-sitter generation complains about conflicts, prefer to add minimal `conflicts: [...]` entries rather than overcomplicated precedence changes.
- IDENTIFIERS and KEYWORDS:
  - Keyword tokens are usually `token(prec(n, 'literal'))` in `grammar.js`.
  - DO NOT change the builtin names lightly — the upstream nom parser uses double-underscored names for IO builtins, and the grammar should match that exact spelling: `__print`, `__pure`, `__bind`, `__readline`.
  - Ensure `word` is set to the identifier token the grammar intends editors to treat as the word under cursor (often `$.term_identifier`).
- Avoid letting `term_parens` contain `expr` if you intend parentheses to be atomic in application/infix positions.
  - If parentheses contain full `expr`, parenthesised expressions can become atoms that swallow surrounding constructs — that's a common source of ambiguity and unexpected behavior.

Debugging parse output
- `tree-sitter parse FILE` prints the CST. Inspect locations of `(ERROR ...)` nodes and the smallest node that contains them.
- Two frequent causes of an `ERROR` in examples:
  1. A newline/comment sits between tokens where the grammar expects a non-trivial token; the grammar didn't accept optional leading newline in that position.
     - Fix: add a local `maybe_*` helper (as described) or update the surrounding rule to accept a `seq(repeat1(choice($.newline,$.comment)), X)`.
  2. A token was not recognized (identifier vs keyword vs operator); check the token regex and `prec` wrapping for keywords.
- When `tree-sitter generate` fails, read the error text — common failures:
  - "matches the empty string" — you created an empty-match rule.
  - "conflicts" — ambiguous productions requiring `conflicts([...])` or additional precedence.

Testing strategy
- Start by parsing individual examples you changed behavior for. Use `tree-sitter parse` and check for `ERROR` nodes.
- Run the test suite with `./test/test.sh` to ensure all fixtures in `test/fixtures/` still pass.
- After local success, run a sweep through `../stlcpp/examples` and collect any files that still produce `ERROR` nodes. Report both the filename and a one-line parse snippet showing the ERROR location.
- If you make changes that rename node types, update `queries/highlights.scm` accordingly.

Editing & committing rules
- Edit only `grammar.js` and any support files (`queries/`, `test/`) by hand.
- **DO NOT commit generated artifacts** (`src/` directory). The `src/` directory is gitignored and generated during build.
- After `tree-sitter generate` (for local testing), commit only your `grammar.js` changes.
- The Nix build (`package.nix`) automatically runs `tree-sitter generate` during the build process.
- Keep commit messages focused: explain the grammar change and include a short rationale (e.g., "Add support for sum types at type level" or "Allow newline after '=>' in case arms").

Conservative change guidelines
- If you are unsure about a big change (global trivia, operator fixity refactor, etc.), make a small local change first and run the example suite. Large refactors are riskier — prefer an iterative approach with many small commits so regressions are easy to bisect.
- Document any non-obvious design choices inside `grammar.js` as comments so maintainers (human and automated) understand why a rule exists.

Developer UX notes for an agent
- Always run `tree-sitter generate` after editing `grammar.js` for local testing.
- Run `./test/test.sh` to verify all test fixtures still pass.
- **Never commit the `src/` directory** — it is gitignored and will be generated during build.
- If you cannot run `tree-sitter generate` or `tree-sitter parse`, you can still reason about grammar changes conservatively, but clearly indicate that your changes are untested and request that a human run the generator and parser locally.

Useful quick commands (for a human operator; the agent can include these in reports)
- Generate parser artifacts (for local testing):
  - `tree-sitter generate`
- Parse a file with the generated parser:
  - `tree-sitter parse PATH_TO_FILE`
- Run the test suite:
  - `./test/test.sh`
- Search the grammar for symbol usage:
  - Use repo-wide text search for symbol names (search for `term_primary`, `application`, `maybe_infix`, etc.)
- Run a sweep of examples (example approach for a human):
  - Loop parse over `../stlcpp/examples/*.stlc` and collect outputs that include `ERROR`.

If you are the agent taking action now
- Make minimal edits, run the generator, parse targeted examples, and report back:
  - Files changed, generator output, and any remaining `ERROR` examples (with short parse snips).
- If you cannot run commands in this environment, prepare a detailed patch (edited `grammar.js`) and include step-by-step instructions for the maintainer to run locally and reproduce tests.

Contact points / references
- When in doubt, mirror the behavior of the upstream Rust parser (the repo owners provided references to `src/module/parse.rs`, `src/syntax/parse.rs`, `src/term/parse.rs` in the upstream `stlcpp` project). Use those as authoritative guidance for tricky language-level behavior (fixities, where `newline` matters, name of builtins).
- Keep keywords identical to upstream (including double-underscore builtins).
