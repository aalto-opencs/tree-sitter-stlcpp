# Work-in-Progress Test Fixtures

This directory contains STLC++ example files that currently parse with ERROR nodes. These are from the upstream `stlcpp/examples` directory and represent real-world STLC++ code.

## Recently Fixed Issues ✅

The following issues have been resolved and the affected files moved to `test/fixtures/`:

### Application Parsing Refactor
**Fixed in:** church.stlc, list.stlc (both now in `fixtures/`)

**Major change:** Refactored application parsing from greedy `repeat1(argument)` to binary left-associative style, following tree-sitter-haskell patterns.

**Benefits:**
- ✅ Multi-argument applications like `f x y z` now parse correctly
- ✅ Type arguments followed by list literals work: `count Int [1, 2:Int]`
- ✅ Complex church encoding applications parse correctly

**Solution to `[` ambiguity:** Explicitly excluded `type_list_brackets` from application arguments to resolve LR(1) conflict between list literals `[expr, ...: Type]` and type list brackets `[Type]`.

See `APPLICATION_PARSING.md` for technical details.

### Composition Operator (`.`)
**Fixed in:** compose.stlc (now in `fixtures/`)

Added support for `.` as an infix operator for function composition, while preserving module paths like `io.bind`.

### Arithmetic Operators (`+`, `-`)
**Fixed in:** fib.stlc, compose.stlc (both now in `fixtures/`)

Fixed `+` and other operators not being recognized in infix position after applications.

### Newlines in Control Flow
**Fixed in:** fib.stlc (now in `fixtures/`)

Added support for newlines after `then`, `else`, and commas in function expressions.

### Comments in List Literals
**Fixed in:** comments.stlc (now in `fixtures/`)

Fixed support for comments between list elements and before closing brackets.

## Remaining Known Issues

These fixtures highlight remaining grammar limitations:

### Multi-Line Applications

**Files affected:** io.stlc (15 errors remaining)

The grammar **cannot** parse applications where arguments appear on separate lines due to lack of indentation sensitivity:

```stlc
// ❌ Doesn't work
io.bind String Unit
    (fun s : String, ...)
    io.readline

// ✅ Works
io.bind String Unit (fun s : String, ...) io.readline

// ✅ Also works (with explicit grouping)
(io.bind String Unit
    (fun s : String, ...)
    io.readline)
```

**Root cause:** Tree-sitter's LR parser cannot distinguish between:
- A newline ending an expression (starting a new statement)
- A newline within an expression (continuing an application)

Without indentation information, after parsing `io.bind String Unit`, the parser cannot tell if the next line starts a new statement or continues the application.

**Comparison to upstream:** The upstream Rust/nom parser can handle this because:
1. It uses PEG/parser combinators (can backtrack)
2. May use indentation heuristics
3. Different parsing strategy than tree-sitter's LR(1) GLR

**Status:** This is a **known limitation** of tree-sitter without an external scanner for indentation. Solutions:
1. **Workaround**: Use single-line applications or explicit parentheses
2. **Future**: Implement indentation-sensitive external scanner (complex)
3. **Accept**: Document as a style constraint for tree-sitter parsing

See `APPLICATION_PARSING.md` for detailed technical explanation.

### Custom Syntax Declarations

**Files affected:** operators.stlc

The grammar doesn't support custom syntax declarations:

```stlc
infixl 6 .+ a b = a
infixr 5 .* x y = x
prefix .! x = x
```

**Root cause:** These are meta-level declarations that define new syntax. Implementing these would require:
1. Adding grammar rules for `infixl`, `infixr`, `prefix` declarations
2. Potentially dynamic precedence handling (complex in tree-sitter)

**Status:** Low priority - these are advanced language features not commonly used in basic STLC++ code.

## Testing These Fixtures

These files are NOT tested by the main test suite (`../test.sh`) to keep CI green. To test them manually:

```bash
tree-sitter parse test/fixtures-wip/church.stlc
```

## Moving Files Back

Once grammar improvements resolve the parse errors for a file, move it back to `test/fixtures/`:

```bash
mv test/fixtures-wip/church.stlc test/fixtures/
./test/test.sh  # Verify it passes
```

## Contributing

If you fix one of these issues:
1. Move the passing fixture(s) back to `fixtures/`
2. Update this README to document what was fixed
3. Add a note in the commit message about which fixture(s) now pass
