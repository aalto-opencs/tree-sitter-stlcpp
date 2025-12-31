# Work-in-Progress Test Fixtures

This directory contains STLC++ example files that currently parse with ERROR nodes. These are from the upstream `stlcpp/examples` directory and represent real-world STLC++ code.

## Known Issues

These fixtures highlight remaining grammar limitations:

### Multi-line Function Applications

**Files affected:** compose.stlc, church.stlc, io.stlc

The grammar currently doesn't allow newlines between a function and its arguments in application position:

```stlc
f
    arg1
    arg2
```

This is a common pattern in the upstream examples but creates ambiguity in the LR parser.

### Infix/Prefix Operator Edge Cases

**Files affected:** operators.stlc, fib.stlc

Some operator patterns create conflicts:
- Operators in certain positions
- Complex infix chains
- Mixing prefix and infix operators

### Comment Handling

**Files affected:** comments.stlc

Some edge cases in comment placement may not be fully handled.

## Testing These Fixtures

These files will NOT be tested by the main test suite (`../test.sh`) to keep CI green. To test them manually:

```bash
tree-sitter parse fixtures-wip/compose.stlc
```

## Moving Files Back

Once grammar improvements resolve the parse errors for a file, move it back to `test/fixtures/`:

```bash
mv fixtures-wip/compose.stlc fixtures/
./test.sh  # Verify it passes
```

## Contributing

If you fix one of these issues:
1. Move the passing fixture(s) back to `fixtures/`
2. Update this README to remove the file from the known issues list
3. Add a note in the commit message about which fixture(s) now pass
