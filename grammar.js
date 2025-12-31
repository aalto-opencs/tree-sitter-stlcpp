// Tree-sitter grammar for a pragmatic subset of STLC++ (stlcpp).
//
// Goals for this variant:
// - Treat newline and comment as regular tokens (not global extras) so the
//   grammar can explicitly control where blank/comment-only lines are allowed.
// - Add a top-level `_separator` composed of one-or-more newlines/comments and
//   use it in `source_file` so inner constructs (like application) cannot
//   span blank/comment-only lines.
// - Make `term_primary` the canonical set of atomic term forms. Previously a
//   separate `_atom` rule allowed full `expr` to be nested inside parentheses
//   via `term_parens`. That permitted arbitrarily large expressions inside a
//   parenthesised "atom" and made the `_atom`/`term_primary` split meaningless.
//   This file therefore replaces usages of `_atom` with `term_primary` and
//   changes `term_parens` to contain only a `term_primary` (not a full `expr`).
//
// Notes / design decisions:
// - Horizontal whitespace (spaces, tabs, formfeed, CR) are left in `extras` so
//   tokens can be separated normally without explicit tokens.
// - `newline` and `comment` are ordinary tokens. The top-level `source_file`
//   consumes sequences of statements interleaved with `_separator`, preventing
//   applications from greedily swallowing blank/comment lines.
// - A small number of rules can still explicitly refer to `$.newline` if a
//   physical line break must be enforced; otherwise newlines are consumed only
//   by separators between top-level statements.

const PREC = {
  assignment: 1,

  // Type-level precedences (higher binds tighter):
  // arrow: 2 (lowest, right-associative)
  // sum: 3 (binds tighter than arrow, left-associative)
  // So "A -> B + C -> D" parses as "A -> (B + C) -> D"
  arrow: 2,
  sum: 3,

  // Term-level precedence ladder:
  //   expr -> if/let/fun/case... OR infix_expression
  //   infix_expression -> application_or_primary (operator application_or_primary)+
  //   application -> term_primary (argument)+
  //
  // Keep custom operators at a single precedence level for stable parsing.
  prefix: 4,
  infix: 5,
  application: 6,
};

module.exports = grammar({
  name: "stlcpp",

  // Horizontal whitespace is global trivia so tokens can be separated normally.
  // We treat newline and comment as tokens so we can explicitly control them.
  extras: ($) => [/[ \t\f\r]/],

  word: ($) => $.term_identifier,

  // Local ambiguities are expected around case/lcase arm lists; declare conflicts
  // so the generator accepts the grammar and runtime disambiguates.
  conflicts: ($) => [[$.case_expression], [$.lcase_expression]],

  rules: {
    // Treat a source file as a sequence of module-level items with separators.
    // This prevents trailing newlines/comments at EOF from producing ERROR nodes
    // because the top-level consumes that trivia explicitly.
    source_file: ($) =>
      seq(
        optional($._separator),
        repeat(seq($._statement, optional($._separator))),
      ),

    // Separator for top-level statements: one or more newlines and/or comments.
    // By making this explicit and using it only at the top-level, inner constructs
    // are prevented from crossing blank/comment-only lines.
    _separator: ($) => repeat1(choice($.newline, $.comment)),

    // Helper rules that allow optional leading inline trivia before certain
    // expression shapes. These accept either one-or-more newlines/comments
    // followed by the expected expression, or the expression without leading
    // trivia. Using `repeat1` here avoids introducing a rule that can match the
    // empty string (Tree-sitter disallows rules that can match empty strings
    // unless they are the start rule).
    maybe_infix: ($) =>
      choice(
        seq(repeat1(choice($.newline, $.comment)), $.infix_expression),
        $.infix_expression,
      ),
    maybe_expr: ($) =>
      choice(seq(repeat1(choice($.newline, $.comment)), $.expr), $.expr),

    // ----------------------------------------------------------------------------
    // Statements / top-level-ish forms
    // ----------------------------------------------------------------------------
    _statement: ($) =>
      choice(
        $.import_statement,
        $.fixity_declaration,
        $.type_alias_declaration,
        $.declaration,
        $.value_definition,
      ),

    // import a.b
    import_statement: ($) =>
      seq(field("keyword", $.kw_import), field("module", $.term_identifier)),

    // Fixity declarations:
    // infixl a OP b = expr
    // infixr a OP b = expr
    // prefix OP x = expr
    fixity_declaration: ($) =>
      choice(
        seq(
          field("assoc", choice($.kw_infixl, $.kw_infixr)),
          field("left", $.term_identifier_or_hole),
          field("operator", $.operator),
          field("right", $.term_identifier_or_hole),
          field("equals", $.equals),
          field("value", $.maybe_expr),
        ),
        seq(
          field("keyword", $.kw_prefix),
          field("operator", $.operator),
          field("param", $.term_identifier_or_hole),
          field("equals", $.equals),
          field("value", $.maybe_expr),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Type alias declaration
    // ----------------------------------------------------------------------------
    type_alias_declaration: ($) =>
      prec.right(
        PREC.assignment,
        seq(
          field("name", $.type_identifier),
          field("colon", $.colon),
          field("sort", $.kw_Type),
          optional(
            seq(
              field("name2", $.type_identifier),
              field("equals", $.equals),
              field("value", $.type),
            ),
          ),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Declarations (top-level)
    // ----------------------------------------------------------------------------
    declaration: ($) =>
      prec.right(
        PREC.assignment,
        seq(
          field("name", $.term_identifier),
          field("colon", $.colon),
          field("type", $.type),
          optional(
            seq(
              field("name2", $.term_identifier),
              field("equals", $.equals),
              field("value", $.maybe_expr),
            ),
          ),
        ),
      ),

    // x = expr
    value_definition: ($) =>
      prec.right(
        PREC.assignment,
        seq(
          field("name", $.term_identifier),
          field("equals", $.equals),
          field("value", $.maybe_expr),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Types
    // ----------------------------------------------------------------------------
    // `type` is the top-level entrypoint for type syntax. We parse four forms:
    //  - `forall` quantifiers
    //  - right-associative arrow chains (A -> B -> C)
    //  - left-associative sum types (A + B + C)
    //  - primary types (identifiers, parens, products, lists, apps)
    //
    // Precedence: forall > arrow > sum > primary
    // So "A -> B + C -> D" parses as "A -> (B + C) -> D"
    type: ($) => $.type_expr,
    type_expr: ($) =>
      choice(
        // forall T, Type
        seq(
          field("keyword", $.kw_forall),
          field("tvar", $.type_identifier),
          optional(seq(field("colon", $.colon), field("sort", $.kw_Type))),
          field("comma", $.comma),
          field("body", $.type_expr),
        ),

        // Right-associative arrow chain built from sum expressions.
        // This accepts `A -> B` and `A -> B -> C` etc., associating to the right.
        prec.right(
          PREC.arrow,
          seq(
            field("left", $.type_sum_or_primary),
            repeat(seq(field("arrow", $.arrow), field("right", $.type))),
          ),
        ),

        // Sum or primary
        $.type_sum_or_primary,
      ),

    // Sum types are left-associative: A + B + C parses as (A + B) + C
    type_sum_or_primary: ($) =>
      choice(
        prec.left(
          PREC.sum,
          seq(
            field("left", $.type_primary),
            repeat1(seq(field("plus", $.plus), field("right", $.type_primary))),
          ),
        ),
        $.type_primary,
      ),

    // Deprecated alias for backward compatibility
    type_sum: ($) => $.type_sum_or_primary,

    type_primary: ($) =>
      choice(
        $.type_identifier,
        $.type_parens,
        $.type_prod,
        $.type_list_brackets,
        $.type_app,
      ),

    type_parens: ($) =>
      seq(
        field("lparen", $.lparen),
        field("type", $.type_expr),
        field("rparen", $.rparen),
      ),

    type_prod: ($) =>
      seq(
        field("lparen", $.lparen),
        field("left", $.type_expr),
        field("comma", $.comma),
        field("right", $.type_expr),
        field("rparen", $.rparen),
      ),

    type_list_brackets: ($) =>
      seq(
        field("lbrack", $.lbrack),
        field("type", $.type_expr),
        field("rbrack", $.rbrack),
      ),

    type_app: ($) =>
      prec.right(
        PREC.application,
        seq(field("ctor", $.type_identifier), field("arg", $.type_primary)),
      ),

    // ----------------------------------------------------------------------------
    // Terms / expressions
    // ----------------------------------------------------------------------------
    expr: ($) =>
      choice(
        $.if_expression,
        $.let_expression,
        $.fun_expression,
        $.tfun_expression,
        $.case_expression,
        $.lcase_expression,
        $.infix_expression,
      ),

    if_expression: ($) =>
      seq(
        field("if", $.kw_if),
        field("cond", $.expr),
        field("then", $.kw_then),
        optional(repeat1(choice($.newline, $.comment))),
        field("then_expr", $.expr),
        optional(repeat1(choice($.newline, $.comment))),
        field("else", $.kw_else),
        optional(repeat1(choice($.newline, $.comment))),
        field("else_expr", $.expr),
      ),

    let_expression: ($) =>
      seq(
        field("let", $.kw_let),
        field("name", $.term_identifier),
        field("equals", $.equals),
        field("value", $.maybe_infix),
        field("in", $.kw_in),
        field("body", $.maybe_expr),
      ),

    fun_expression: ($) =>
      seq(
        field("fun", $.kw_fun),
        field("param", $.term_identifier_or_hole),
        field("colon", $.colon),
        field("type", $.type_expr),
        field("comma", $.comma),
        optional(repeat1(choice($.newline, $.comment))),
        field("body", $.expr),
      ),

    tfun_expression: ($) =>
      seq(
        field("fun", $.kw_fun),
        field("tparam", $.type_identifier),
        optional(seq(field("colon", $.colon), field("sort", $.kw_Type))),
        field("comma", $.comma),
        optional(repeat1(choice($.newline, $.comment))),
        field("body", $.expr),
      ),

    case_expression: ($) =>
      seq(
        field("case", $.kw_case),
        field("scrutinee", $.expr),
        field("of", $.kw_of),
        optional(field("lbrace", $.lbrace)),
        optional(repeat1(choice($.newline, $.comment))),
        $.case_arm,
        repeat(seq(repeat1(choice($.newline, $.comment)), $.case_arm)),
        optional(repeat1(choice($.newline, $.comment))),
        optional(field("rbrace", $.rbrace)),
      ),

    case_arm: ($) =>
      seq(
        field("bar", $.bar),
        field("ctor", choice($.kw_inl, $.kw_inr)),
        field("binder", $.term_identifier_or_hole),
        field("arrow", $.fat_arrow),
        field("body", $.maybe_expr),
      ),

    lcase_expression: ($) =>
      seq(
        field("lcase", $.kw_lcase),
        field("scrutinee", $.expr),
        field("of", $.kw_of),
        optional(field("lbrace", $.lbrace)),
        optional(repeat1(choice($.newline, $.comment))),
        $.lcase_arm,
        repeat(seq(repeat1(choice($.newline, $.comment)), $.lcase_arm)),
        optional(repeat1(choice($.newline, $.comment))),
        optional(field("rbrace", $.rbrace)),
      ),

    lcase_arm: ($) =>
      choice(
        seq(
          field("bar", $.bar),
          field("nil", $.kw_nil),
          field("arrow", $.fat_arrow),
          field("body", $.maybe_expr),
        ),
        seq(
          field("bar", $.bar),
          field("cons", $.kw_cons),
          field("head", $.term_identifier_or_hole),
          field("tail", $.term_identifier_or_hole),
          field("arrow", $.fat_arrow),
          field("body", $.maybe_expr),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Core expression layers
    // ----------------------------------------------------------------------------
    // Make `term_primary` the canonical "atom" set used by application/infix.
    term_primary: ($) =>
      choice(
        $.integer,
        $.boolean,
        $.unit,
        $.term_identifier,
        $.term_parens,
        $.pair,
        $.list_literal,
        $.injection,
        $.nil_term,
        $.io_primitive,
        $.char_literal,
        $.string_literal,
      ),

    // Binary left-associative application (Haskell-style)
    // `f x y` parses as `apply(apply(f, x), y)`
    // Note: Cannot allow newlines before arguments without indentation sensitivity,
    // as this creates ambiguity (parser can't tell if next line starts new statement)
    application: ($) =>
      prec.left(
        PREC.application,
        seq(
          field("function", $.application_or_primary),
          field("argument", $.app_argument),
        ),
      ),

    // Application arguments: allow both term and type arguments
    // Exclude type_app to prevent `f Int [...]` from parsing as `f (Int [...])`
    // where `Int [...]` is treated as type application.
    // This means type applications like `List Int` must be parenthesized in application position: `f (List Int)`
    app_argument: ($) =>
      choice(
        $.term_primary,
        alias(
          choice($.type_identifier, $.type_parens, $.type_prod, $.type_list_brackets),
          $.type_primary
        ),
      ),

    prefix_application: ($) =>
      prec.right(
        PREC.prefix,
        seq(
          field("operator", $.operator),
          field("argument", $.application_or_primary),
        ),
      ),

    infix_expression: ($) =>
      prec.left(
        PREC.infix,
        seq(
          field("left", $.application_or_primary),
          repeat(
            seq(
              field("operator", $.operator),
              field("right", $.application_or_primary),
            ),
          ),
        ),
      ),

    application_or_primary: ($) => choice($.application, $.term_primary),

    // Parentheses around terms allow full expressions to support grouping in infix
    // chains and other contexts (e.g., `(fun x, e)` or `(a *> b *> c)`).
    term_parens: ($) =>
      seq(
        field("lparen", $.lparen),
        field("term", $.expr),
        field("rparen", $.rparen),
      ),

    pair: ($) =>
      seq(
        field("lparen", $.lparen),
        field("left", $.expr),
        field("comma", $.comma),
        field("right", $.expr),
        field("rparen", $.rparen),
      ),

    list_literal: ($) =>
      seq(
        field("lbrack", $.lbrack),
        optional(
          seq(
            field("head", $.expr),
            repeat(
              seq(
                field("comma", $.comma),
                optional(repeat1(choice($.newline, $.comment))),
                field("tail", $.expr),
              ),
            ),
            optional(field("trailing_comma", $.comma)),
          ),
        ),
        optional(repeat1(choice($.newline, $.comment))),
        field("colon", $.colon),
        field("type", $.type_expr),
        optional(repeat1(choice($.newline, $.comment))),
        field("rbrack", $.rbrack),
      ),

    injection: ($) =>
      seq(
        field("ctor", choice($.kw_inl, $.kw_inr)),
        field("value", $.term_primary),
        field("type", $.type_primary),
      ),

    nil_term: ($) => seq(field("nil", $.kw_nil), field("type", $.type_primary)),

    io_primitive: ($) =>
      choice(
        $.kw___readline,
        seq(field("kw", $.kw___print), field("arg", $.term_primary)),
        seq(
          field("kw", $.kw___pure),
          field("type", $.type_primary),
          field("arg", $.term_primary),
        ),
        seq(
          field("kw", $.kw___bind),
          field("dom", $.type_primary),
          field("cod", $.type_primary),
          field("func", $.term_primary),
          field("arg", $.term_primary),
        ),
        seq(
          field("kw", $.kw_panic),
          field("type", $.type_expr),
          field("arg", $.expr),
        ),
        seq(
          field("kw", $.kw_trace),
          field("index", $.integer),
          field("arg", $.expr),
        ),
      ),

    unit: ($) => seq(field("lparen", $.lparen), field("rparen", $.rparen)),

    integer: (_) => token(/[0-9]+/),

    boolean: ($) => choice($.kw_true, $.kw_false),

    char_literal: (_) =>
      token(
        seq(
          "'",
          choice(
            /[^'\\]/,
            /\\[nrtbf\\\\\\/"]/,
            seq(
              "\\u",
              "{",
              choice(
                /[0-9a-fA-F]/,
                seq(/[0-9a-fA-F]/, /[0-9a-fA-F]/),
                seq(/[0-9a-fA-F]/, /[0-9a-fA-F]/, /[0-9a-fA-F]/),
                seq(/[0-9a-fA-F]/, /[0-9a-fA-F]/, /[0-9a-fA-F]/, /[0-9a-fA-F]/),
                seq(
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                ),
                seq(
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                  /[0-9a-fA-F]/,
                ),
              ),
              "}",
            ),
          ),
          "'",
        ),
      ),

    string_literal: (_) =>
      token(
        seq(
          '"',
          repeat(
            choice(
              /[^"\\]/,
              /\\[nrtbf\\\\\\/"]/,
              seq(
                "\\u",
                "{",
                choice(
                  /[0-9a-fA-F]/,
                  seq(/[0-9a-fA-F]/, /[0-9a-fA-F]/),
                  seq(/[0-9a-fA-F]/, /[0-9a-fA-F]/, /[0-9a-fA-F]/),
                  seq(
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                  ),
                  seq(
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                  ),
                  seq(
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                    /[0-9a-fA-F]/,
                  ),
                ),
                "}",
              ),
            ),
          ),
          '"',
        ),
      ),

    // ----------------------------------------------------------------------------
    // Identifiers
    // ----------------------------------------------------------------------------
    term_identifier: (_) => token(/[a-z][A-Za-z0-9._']*/),

    term_identifier_or_hole: (_) => token(choice("_", /[a-z][A-Za-z0-9._']*/)),

    type_identifier: (_) => token(choice("_", /[A-Z][A-Za-z0-9]*/)),

    // ----------------------------------------------------------------------------
    // Comments and newlines (tokens)
    // ----------------------------------------------------------------------------
    comment: (_) => token(seq("//", /.*/)),

    // Explicit newline token. Not in `extras`; used inside `_separator`.
    newline: (_) => token(/\r?\n/),

    // ----------------------------------------------------------------------------
    // Punctuation / operators (named tokens for highlighting)
    // ----------------------------------------------------------------------------
    lparen: (_) => token("("),
    rparen: (_) => token(")"),
    lbrack: (_) => token("["),
    rbrack: (_) => token("]"),
    lbrace: (_) => token("{"),
    rbrace: (_) => token("}"),
    comma: (_) => token(","),
    colon: (_) => token(":"),
    bar: (_) => token("|"),

    equals: (_) => token("="),

    arrow: (_) => token("->"),

    fat_arrow: (_) => token("=>"),

    plus: (_) => token("+"),

    operator: (_) =>
      token(
        choice(
          // Special cases for operators starting with special chars
          "==",
          ".",  // Function composition operator (when surrounded by whitespace)
          "+",  // Addition and other plus-based operators
          seq("=", /[^.\s\w()\[\]{},:|=>]/, /[^.\s\w()\[\]{},:|=]*/),
          "-",
          seq("-", /[^.>\s\w()\[\]{},:|=+]/, /[^.\s\w()\[\]{},:|=+]*/),
          seq("+", /[^.\s\w()\[\]{},:|=]/, /[^.\s\w()\[\]{},:|=]*/),  // Operators starting with +
          // General operator pattern (exclude =, +, -, and other special chars)
          /[^.\s\w()\[\]{},:|=+|-][^.\s\w()\[\]{},:|=+]*/,
        ),
      ),

    // ----------------------------------------------------------------------------
    // Keywords
    // ----------------------------------------------------------------------------
    kw_import: (_) => token(prec(2, "import")),
    kw_fun: (_) => token(prec(2, "fun")),
    kw_forall: (_) => token(prec(2, "forall")),
    kw_Type: (_) => token(prec(2, "Type")),

    kw_let: (_) => token(prec(2, "let")),
    kw_in: (_) => token(prec(2, "in")),

    kw_if: (_) => token(prec(2, "if")),
    kw_then: (_) => token(prec(2, "then")),
    kw_else: (_) => token(prec(2, "else")),

    kw_case: (_) => token(prec(2, "case")),
    kw_lcase: (_) => token(prec(2, "lcase")),
    kw_of: (_) => token(prec(2, "of")),

    kw_nil: (_) => token(prec(2, "nil")),
    kw_cons: (_) => token(prec(2, "cons")),

    kw_inl: (_) => token(prec(2, "inl")),
    kw_inr: (_) => token(prec(2, "inr")),

    kw_fst: (_) => token(prec(2, "fst")),
    kw_snd: (_) => token(prec(2, "snd")),

    kw_fix: (_) => token(prec(2, "fix")),

    kw_true: (_) => token(prec(2, "true")),
    kw_false: (_) => token(prec(2, "false")),

    kw_panic: (_) => token(prec(2, "panic")),
    kw_trace: (_) => token(prec(2, "trace")),

    kw_infixl: (_) => token(prec(2, "infixl")),
    kw_infixr: (_) => token(prec(2, "infixr")),
    kw_prefix: (_) => token(prec(2, "prefix")),

    // STLC++ builtins with double underscores — keep exact names to match upstream.
    kw___print: (_) => token(prec(2, "__print")),
    kw___pure: (_) => token(prec(2, "__pure")),
    kw___bind: (_) => token(prec(2, "__bind")),
    kw___readline: (_) => token(prec(2, "__readline")),
  },
});
