# Tree-sitter-stlcpp Tests

This directory contains test fixtures for the STLC++ tree-sitter grammar.

## Test Fixtures

The `fixtures/` directory contains example STLC++ programs that successfully parse without errors:

### Passing Test Cases

- **basic_declaration.stlc** - Basic type declarations and value definitions
- **sum_types.stlc** - Sum types (`A + B`) at type level and case analysis
- **list_case.stlc** - List case analysis (`lcase`) with `nil` and `cons` patterns

### Work-in-Progress Fixtures

The `fixtures-wip/` directory contains examples from `stlcpp/examples` that have known parsing issues. See `fixtures-wip/README.md` for details on:

- **fib.stlc**, **compose.stlc**, **church.stlc**, **io.stlc** - Multi-line function application issues
- **operators.stlc** - Complex operator patterns
- **comments.stlc** - Comment edge cases

These are excluded from the main test suite but useful for tracking grammar improvements.

## Running Tests

### Using the test script

```bash
./test.sh
```

This will parse all fixtures and report:
- ✓ PASS - File parses without ERROR nodes
- ✗ FAIL - File contains ERROR nodes or fails to parse

### Manual testing

Parse a single file:
```bash
tree-sitter parse fixtures/basic_declaration.stlc
```

Parse and show the tree:
```bash
tree-sitter parse fixtures/sum_types.stlc
```

### Expected Behavior

All fixtures in this directory should parse without ERROR nodes. If a fixture shows ERROR nodes, it indicates either:
1. A bug in the grammar that needs fixing
2. Invalid STLC++ syntax in the fixture (the fixture needs correction)

## Adding New Tests

To add new test cases:

1. Create a `.stlc` file in `fixtures/` with descriptive name
2. Add comments explaining what feature is being tested
3. Run `./test.sh` to verify it parses correctly
4. If it fails, either fix the grammar or the test case

## Integration with Nix

The `package.nix` in the project root includes a `checkPhase` that automatically runs tests on all fixtures during the Nix build process.
