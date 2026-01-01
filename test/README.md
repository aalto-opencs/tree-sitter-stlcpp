# Tree-sitter-stlcpp Tests

This directory contains the test suite for the STLC++ tree-sitter grammar using the standard tree-sitter corpus format.

## Corpus Tests

The test suite uses tree-sitter's standard corpus format with test cases organized in `corpus/*.txt` files:

- **applications.txt** - Application parsing (binary left-associative chaining)
- **declarations.txt** - Type and value declarations
- **functions.txt** - Function expressions (simple, curried, polymorphic, holes)
- **lists.txt** - List literals and lcase expressions
- **sum_types.txt** - Sum types and case expressions
- **types.txt** - Type system features (forall, arrows, products, etc.)
- **operators.txt** - Infix operators (composition, arithmetic, comparison)
- **control_flow.txt** - If-then-else and case expressions
- **comments.txt** - Comment handling

Each corpus file contains multiple test cases with:
- Input STLC++ code
- Expected parse tree (S-expression format)

## Running Tests

```bash
tree-sitter test
```

This runs all 53 corpus tests and reports:
- ✓ Test passes - Parse tree matches expected
- ✗ Test fails - Parse tree differs from expected

## Adding Tests

1. Edit or create a corpus file in `test/corpus/`
2. Add a new test case with this format:
   ```
   ================================================================================
   Test name describing the feature
   ================================================================================

   [STLC++ code here]

   --------------------------------------------------------------------------------

   [Expected parse tree - leave empty initially]
   ```
3. Run `tree-sitter test --update` to auto-generate the expected tree
4. Run `tree-sitter test` to verify

## Test Coverage

The corpus tests provide comprehensive coverage:

- **Applications**: 6 tests (simple, multi-arg, type args, church encoding)
- **Declarations**: 3 tests (basic, function types, module paths)
- **Functions**: 4 tests (simple, curried, polymorphic, holes)
- **Lists**: 4 tests (literals, nested, lcase, builtins)
- **Sum types**: 5 tests (signatures, case, inl/inr)
- **Types**: 12 tests (all type system features)
- **Operators**: 10 tests (composition, arithmetic, comparison)
- **Control flow**: 4 tests (if-else, nested, case)
- **Comments**: 5 tests (placement, list literals, multiple)

**Total: 53 corpus tests** covering all major language features

## Manual Testing

To manually test parsing on STLC++ files:

```bash
# Parse a file and show the tree
tree-sitter parse <file.stlc>

# Parse quietly (no position info)
tree-sitter parse --quiet <file.stlc>

# Parse and check for errors
tree-sitter parse <file.stlc> 2>&1 | grep ERROR
```

Test against upstream examples:

```bash
# Parse all upstream examples
for file in ../stlcpp/examples/*.stlc; do
  echo "=== $(basename $file) ==="
  tree-sitter parse "$file" 2>&1 | grep -c ERROR || echo "✓ No errors"
done
```

## Integration with CI/CD

The Nix build (`package.nix`) runs `tree-sitter test` during the check phase, ensuring all corpus tests pass before the build succeeds.
