# Application Parsing in tree-sitter-stlcpp

## Overview

This document explains how application (function call) parsing works in the STLC++ tree-sitter grammar, following best practices from tree-sitter-haskell.

## Key Design: Binary Left-Associative Applications

Following the Haskell tree-sitter grammar, we use **binary application** rather than consuming multiple arguments at once:

```javascript
application: ($) =>
  prec.left(
    PREC.application,
    seq(
      field("function", $.application_or_primary),
      field("argument", choice(
        $.term_primary,
        alias(choice($.type_identifier, $.type_parens, $.type_prod, $.type_app), $.type_primary),
      )),
    ),
  ),
```

### How It Works

Multi-argument applications chain through recursion:

```stlc
count Int [1, 2:Int]
```

Parses as (left-associative):

```
application
  function: application
    function: term_primary (count)
    argument: type_primary (Int)
  argument: term_primary (list_literal [1, 2:Int])
```

This is equivalent to: `apply(apply(count, Int), [1, 2:Int])`

## The Type Application Ambiguity Problem

### The Problem

When parsing `count Int [1, 2:Int]`, the parser was incorrectly trying to parse `Int [1, 2:Int]` as a single type application (like `List Int`):

```stlc
count Int [1, 2:Int]
      ^^^^^^^^^^^^^^^
      type_app: Int applied to [1, 2:Int]
```

This happened because `type_app` is defined as `TypeIdentifier type_primary`, and it was greedily consuming both `Int` and the following `[...]`.

### The Real Issue: Type Applications

The ambiguity wasn't between `list_literal` and `type_list_brackets` directly. It was that `type_app` was too greedy in application argument position:

```stlc
// This should parse as three separate arguments:
count Int [1, 2:Int]
      ^^^  ^^^^^^^^^^^
      arg1   arg2

// But was parsing as two arguments:
count (Int [1, 2:Int])
      ^^^^^^^^^^^^^^^
      single type_app argument (ERROR because [1,2:Int] isn't a valid type)
```

### The Solution

We **exclude `type_app`** from application arguments:

```javascript
app_argument: ($) =>
  choice(
    $.term_primary,
    alias(
      choice($.type_identifier, $.type_parens, $.type_prod, $.type_list_brackets),
      $.type_primary
    ),
  ),
```

This prevents `Int [...]` from being parsed as a single type application.

**Trade-off**: Type applications like `List Int` must be parenthesized in application position:
- ❌ `f List Int [1:Int]` - parses as three separate arguments
- ✅ `f (List Int) [1:Int]` - explicit type application

This matches Haskell's requirement for explicit TypeApplications in certain contexts.

## Layout Sensitivity Limitation

Tree-sitter's LR parser cannot handle indentation-sensitive layout without external scanners. This means:

### ✅ Works

```stlc
count Int [1, 2:Int]
f x y z
```

### ❌ Doesn't Work

```stlc
count Int
    [1, 2:Int]

io.bind String Unit
    (fun s : String, ...)
    io.readline
```

**Why**: After parsing `count Int`, when the parser sees a newline followed by `[`, it cannot determine if:
- `[` starts a new statement/expression
- `[` is the next argument to `count Int`

Without indentation information, the parser cannot disambiguate.

**Workaround**: Use single-line applications or explicit parentheses:
```stlc
(count Int [1, 2:Int])

(io.bind String Unit
    (fun s : String, ...)
    io.readline)
```

## Comparison to Upstream STLC++ Parser

The upstream Rust/nom parser can handle multi-line applications because:
1. It uses a different parsing strategy (PEG/parser combinators)
2. It can backtrack and try alternative parsings
3. It may use heuristics or indentation-awareness

Tree-sitter's LR(1) GLR parser is:
- ✅ Much faster
- ✅ Provides incremental parsing for editors
- ❌ Cannot backtrack arbitrarily
- ❌ Limited lookahead

## Reference: tree-sitter-haskell

Our approach is directly inspired by tree-sitter-haskell, which uses the same binary application pattern:

```javascript
// From tree-sitter-haskell/grammar/exp.js
_exp_apply: $ => prec.left('apply', seq(
  field('function', $.expression),
  field('argument', choice(
    $.expression,
    alias($._at_type, $.type_application),
    $.explicit_type,
  )),
)),
```

See:
- `tree-sitter-haskell/grammar/exp.js`
- `tree-sitter-haskell/test/corpus/exp.txt`
- `tree-sitter-haskell/grammar/precedences.js`

## Testing

Test cases demonstrating application parsing:

- `test/fixtures/list.stlc` - Type then list literal arguments
- `test/fixtures/church.stlc` - Multi-argument applications
- `test/fixtures/compose.stlc` - Function composition chains
- `test/fixtures-wip/io.stlc` - Multi-line applications (known limitation)

## Future Work

Potential improvements:

1. **External Scanner**: Implement indentation sensitivity via C scanner
   - Would enable multi-line applications
   - Significant complexity increase

2. **Different Precedence Strategy**: Explore using dynamic precedence more aggressively
   - May help with some edge cases
   - Unlikely to solve layout sensitivity

3. **Accept Limitation**: Document that STLC++ code for editors should prefer:
   - Single-line applications
   - Explicit parentheses for complex multi-line cases
   - This is a common trade-off for tree-sitter grammars

## Style Conventions (from tree-sitter-haskell)

Following Haskell grammar conventions:

1. Use `prec.left` for left-associative chaining
2. Use descriptive field names: `function`, `argument`
3. Document known limitations in comments
4. Use `alias` to provide cleaner node names where appropriate
5. Keep precedence levels organized and documented
6. Modularize large grammars (though our grammar is simple enough to stay monolithic)
