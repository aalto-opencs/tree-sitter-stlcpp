// Tree-sitter grammar for a pragmatic subset of STLC++ (stlcpp).
//
// Goal of this version:
// - Provide stable *named nodes* for punctuation/operators so Zed highlighting
//   can capture those nodes, avoiding literal-token query patterns.
// - Keep parsing permissive enough to work well on upstream examples.
//
// Notes from upstream parser (nom):
// - Line comments: // ...
// - Term identifiers: lowercase initial; may contain . _ '
// - Type identifiers: uppercase initial, alphanumeric only; '_' is a special hole type.
// - Keywords are never valid identifiers.
// - Lots of constructs exist (fun, forall, if/then/else, case/of, lcase/of, etc.).
//
// IMPORTANT:
// - In upstream stlcpp, '.' is part of term identifiers (so `a.b` is a single identifier).
// - Term-level custom operators include *any* non-whitespace, non-alphanumeric character
//   (per upstream `is_symbolic`), but we exclude '.' so identifiers win.
// - Custom operators are term-level only; type syntax uses `->` and does not use custom ops.
// - Char/string literals follow upstream escape support (see `src/term/parse.rs`):
//   escapes: \u{1..6 hex}, \n, \r, \t, \b, \f, \\, \/, \"
//
// This grammar does not attempt to perfectly replicate precedence/associativity of
// every operator in STLC++. It produces a useful tree and explicit operator nodes
// for editor features.
//
// NOTE:
// This grammar treats `newline` as significant (not trivia) to match upstream module parsing,
// but allows newlines in many expression positions to support indented formatting.
///

const PREC = {
  assignment: 1,

  // Type-level arrow precedence is handled in the type grammar.
  arrow: 2,

  // Term-level precedence ladder:
  //   expr -> if/let/fun/case... OR infix_expression
  //   infix_expression -> application_or_primary (operator application_or_primary)+
  //   application -> term_primary (argument)+
  //
  // We keep all custom operators at a single precedence level for now to favor
  // stable parsing/highlighting over semantic precedence.
  prefix: 3,
  infix: 4,
  application: 5,
};

module.exports = grammar({
  name: "stlcpp",

  // NOTE:
  // NOTE:
  // Newlines are significant (not trivia). This is required to prevent module-level
  // declarations from swallowing subsequent definitions and to support newline-delimited
  // syntax like:
  //
  //   a : Ty
  //   a = term
  //
  // We still treat horizontal whitespace as trivia, and comments are trivia.
  extras: ($) => [/[ \t\f\v\r]/, $.comment],

  word: ($) => $.term_identifier,

  // Tree-sitter conflict declarations.
  //
  // This grammar accepts both:
  //   lcase e of | nil => t | cons x xs => u
  // and:
  //   case e of | inl x => t | inr y => u
  // without requiring braces.
  //
  // In practice, this can yield local ambiguities around how arm lists associate,
  // especially with optional braces.
  //
  // Additionally, once we allow optional newlines in/around `of` and at arm boundaries,
  // Tree-sitter can face shift/reduce ambiguity between continuing the arm list vs
  // reducing the enclosing `case_expression`/`lcase_expression`. Make that ambiguity
  // explicit here so the generator can proceed.
  conflicts: ($) => [[$.case_expression], [$.lcase_expression]],

  rules: {
    // Treat a source file as a sequence of module-level items. We intentionally do
    // not accept arbitrary expressions at the top level.
    //
    // IMPORTANT:
    // Newlines are trivia (extras). Therefore we MUST structure the grammar so that:
    // - statements reduce cleanly at EOF
    // - no statement relies on a newline token as a terminator
    // - statement starts are sufficiently disjoint to avoid error-recovery cascades
    //
    // Module is newline-delimited (like upstream). Allow:
    // - blank/comment-only lines
    // - statements separated by one or more newlines
    source_file: ($) =>
      seq(
        repeat(choice($.newline, $.comment)),
        optional(
          seq(
            $._statement,
            repeat(seq(repeat1($.newline), $._statement)),
            optional(repeat1($.newline)),
          ),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Statements / top-level-ish forms
    // ----------------------------------------------------------------------------
    //
    // NOTE: Order matters. Try the most “keyworded/specific” forms first.
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

    // infixl a OP b = expr
    // infixr a OP b = expr
    // infixl _ OP _ = expr   (underscore binders allowed)
    // prefix OP x = expr
    // prefix OP _ = expr
    fixity_declaration: ($) =>
      choice(
        seq(
          field("assoc", choice($.kw_infixl, $.kw_infixr)),
          field("left", $.term_identifier_or_hole),
          field("operator", $.operator),
          field("right", $.term_identifier_or_hole),
          field("equals", $.equals),
          field("value", $.expr),
        ),
        seq(
          field("keyword", $.kw_prefix),
          field("operator", $.operator),
          field("param", $.term_identifier_or_hole),
          field("equals", $.equals),
          field("value", $.expr),
        ),
      ),

    // Type alias declaration (upstream):
    //
    //   State : Type
    //   State = (Integer, Boolean)
    //
    // IMPORTANT:
    // Keep this disjoint from `declaration` (term-level) by using `type_identifier`
    // and the literal sort `Type`.
    type_alias_declaration: ($) =>
      prec.right(
        PREC.assignment,
        seq(
          field("name", $.type_identifier),
          field("colon", $.colon),
          field("sort", $.kw_Type),
          optional(
            seq(
              // Upstream examples sometimes use a plain identifier here (e.g. `Int`)
              // rather than repeating the type name. Accept both.
              field("name2", choice($.type_identifier, $.term_identifier)),
              field("equals", $.equals),
              field("value", $.type),
            ),
          ),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Declarations (top-level)
    // ----------------------------------------------------------------------------
    //
    // Upstream module parser (nom) treats value declarations as:
    //
    //   x : Type
    //   x = Term        (optional; if omitted upstream synthesizes a default panic term)
    //
    // This matches the upstream token model (see `term/tokens.rs`):
    // - `Let` exists only inside term syntax (`let x = t in u`)
    // - Top-level values are declarations/definitions, not expressions.
    //
    // NOTE:
    // We keep this newline-insensitive because newlines
    // are trivia (`extras`). This makes parsing robust in editors.
    // IMPORTANT (module-level):
    // Newlines are trivia (`extras` includes `\s`), so without an explicit terminator
    // a declaration like:
    //
    //   f : Int -> Int
    //   f = fun x : Int, a
    //
    // can be parsed as a *single* `declaration` with the optional value part, because
    // `term_identifier` can start the next statement and there is no newline token
    // to stop the `expr` from greedily consuming following lines.
    //
    // To prevent `declaration` from swallowing subsequent statements, require an
    // explicit terminator after the type (and after the optional value):
    // - either a semicolon `;`
    // - or end-of-file
    //
    // This keeps editor parsing robust even though newlines are skipped as trivia.
    declaration: ($) =>
      prec.right(
        PREC.assignment,
        seq(
          field("name", $.term_identifier),
          field("colon", $.colon),
          field("type", $.type),
          // Optional definition must start on the next line (newline-delimited module syntax).
          optional(
            seq(
              field("newline", $.newline),
              field("name2", $.term_identifier),
              // Allow optional newline(s) around '=' (matches upstream tolerance of at most one NL
              // in many whitespace positions, and supports `main =` followed by an indented term).
              repeat($.newline),
              field("equals", $.equals),
              repeat($.newline),
              field("value", $.expr),
            ),
          ),
        ),
      ),

    // x = expr
    //
    // This must reduce cleanly at EOF, otherwise Zed will show (ERROR ...) for the
    // whole definition block and cascade into spurious errors.
    //
    // Keep this rule *structurally simple* so the parser can reduce it immediately
    // once `value` is complete.
    value_definition: ($) =>
      prec.right(
        PREC.assignment,
        seq(
          field("name", $.term_identifier),
          field("equals", $.equals),
          field("value", $.expr),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Types
    // ----------------------------------------------------------------------------
    // Upstream allows base types (`Integer`, `Boolean`, `Character`, `Unit`) and named
    // types as full types, so `x : Integer` is valid.
    //
    // Type grammar (precedence-aware, single entrypoint)
    //
    // Upstream (`src/type/parse.rs`) parses types with an operator-precedence parser:
    // - `+` (sum) is left-associative and lower precedence
    // - `->` (arrow) is right-associative and higher precedence
    // - `forall` binds at the top and its body is a full type
    //
    // We model this with two operator layers:
    //   type        := forall_type | type_sum
    //   type_sum    := type_arrow ('+' type_arrow)*
    //   type_arrow  := type_primary ('->' type_arrow)?
    //
    // `type` is the only public nonterminal: use it everywhere a type is expected.
    type: ($) => choice($.forall_type, $.type_sum),

    // forall T, Type
    forall_type: ($) =>
      prec.right(
        seq(
          field("keyword", $.kw_forall),
          field("tvar", $.type_identifier),
          optional(seq(field("colon", $.colon), field("sort", $.kw_Type))),
          field("comma", $.comma),
          field("body", $.type),
        ),
      ),

    // Sum types: A + B + C   (left-associative)
    type_sum: ($) =>
      prec.left(
        seq(
          field("left", $.type_arrow),
          repeat(seq(field("operator", $.plus), field("right", $.type_arrow))),
        ),
      ),

    // Arrow types: A -> B -> C   (right-associative)
    type_arrow: ($) =>
      prec.right(
        PREC.arrow,
        seq(
          field("left", $.type_primary),
          optional(seq(field("arrow", $.arrow), field("right", $.type_arrow))),
        ),
      ),

    type_primary: ($) =>
      choice(
        // Base types are *keywords* in upstream:
        // Boolean, Integer, Character, Unit
        $.kw_Boolean,
        $.kw_Integer,
        $.kw_Character,
        $.kw_Unit,

        // Common type constructors used by the upstream type parser.
        // These are not "keywords" in the reserved-word sense, but they are parsed
        // as constructors in `parse_type_primary` (List/IO) and in bracket sugar.
        $.type_list_ctor,
        $.type_io_ctor,

        $.type_identifier, // includes '_' hole
        $.type_parens,
        $.type_prod,
        $.type_list_brackets,
      ),

    // List T   (as in upstream `parse_list_type`)
    type_list_ctor: ($) =>
      prec.right(
        PREC.application,
        seq(field("ctor", $.kw_List), field("arg", $.type_primary)),
      ),

    // IO T  (as in upstream `parse_io_type`)
    type_io_ctor: ($) =>
      prec.right(
        PREC.application,
        seq(field("ctor", $.kw_IO), field("arg", $.type_primary)),
      ),

    type_parens: ($) =>
      seq(
        field("lparen", $.lparen),
        field("type", $.type),
        field("rparen", $.rparen),
      ),

    type_prod: ($) =>
      seq(
        field("lparen", $.lparen),
        field("left", $.type),
        field("comma", $.comma),
        field("right", $.type),
        field("rparen", $.rparen),
      ),

    // Bracket list sugar: [T]  (upstream `parse_list_type_brackets`)
    type_list_brackets: ($) =>
      seq(
        field("lbrack", $.lbrack),
        field("type", $.type),
        field("rbrack", $.rbrack),
      ),

    // ----------------------------------------------------------------------------
    // Terms / expressions
    // ----------------------------------------------------------------------------
    //
    // Refactor goal:
    // - Remove ambiguity around `let ... = <value> in ...` where `<value>` can be a
    //   single atomic term like `2`.
    // - Prevent the parser from getting stuck in an "application continuing" state
    //   where it cannot accept `kw_in`.
    //
    // Strategy:
    // - Define an internal "atom" expression that cannot contain `let`, `if`, etc.
    // - Build application and infix layers on top of atoms.
    // - Keep `let` / `if` / `case` / `lcase` / `fun` at the highest level.
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

    // if e then e else e
    if_expression: ($) =>
      seq(
        field("if", $.kw_if),
        field("cond", $.expr),
        field("then", $.kw_then),
        field("then_expr", $.expr),
        field("else", $.kw_else),
        field("else_expr", $.expr),
      ),

    // let x = e in e
    //
    // IMPORTANT:
    // Use `infix_expression` (not full `expr`) for the value position. This ensures
    // that after parsing a simple literal like `2`, the parser is in a state that can
    // immediately accept `kw_in`, rather than trying to continue as a larger `expr`.
    let_expression: ($) =>
      seq(
        field("let", $.kw_let),
        field("name", $.term_identifier),
        // Allow `let x =` with the value on the next line.
        repeat($.newline),
        field("equals", $.equals),
        repeat($.newline),
        field("value", $.infix_expression),
        field("in", $.kw_in),
        // Allow `in` followed by a newline (as in the upstream examples with indentation).
        repeat($.newline),
        field("body", $.expr),
      ),

    // fun x : T, e
    fun_expression: ($) =>
      seq(
        field("fun", $.kw_fun),
        field("param", $.term_identifier_or_hole),
        field("colon", $.colon),
        field("type", $.type),
        field("comma", $.comma),
        // Allow `fun x : T,` followed by an indented body on the next line(s).
        repeat($.newline),
        field("body", $.expr),
      ),

    // fun T, e   (type abstraction)
    tfun_expression: ($) =>
      seq(
        field("fun", $.kw_fun),
        field("tparam", $.type_identifier),
        optional(seq(field("colon", $.colon), field("sort", $.kw_Type))),
        field("comma", $.comma),
        field("body", $.expr),
      ),

    case_expression: ($) =>
      seq(
        field("case", $.kw_case),
        field("scrutinee", $.expr),
        // Allow newline(s) before `of` in formatted code.
        repeat($.newline),
        field("of", $.kw_of),
        // Allow newline(s) after `of` before arms/braces.
        repeat($.newline),
        optional(field("lbrace", $.lbrace)),
        // Allow newline(s) after `{`
        repeat($.newline),
        // Allow blank lines between arms by permitting newlines between repetitions.
        seq($.case_arm, repeat(seq(repeat1($.newline), $.case_arm))),
        // Allow newline(s) before `}`
        repeat($.newline),
        optional(field("rbrace", $.rbrace)),
      ),

    case_arm: ($) =>
      seq(
        field("bar", $.bar),
        field("ctor", choice($.kw_inl, $.kw_inr)),
        field("binder", $.term_identifier_or_hole),
        field("arrow", $.fat_arrow),
        // Allow newline(s) after `=>` for indented arm bodies.
        repeat($.newline),
        field("body", $.expr),
      ),

    lcase_expression: ($) =>
      seq(
        field("lcase", $.kw_lcase),
        field("scrutinee", $.expr),
        // Allow newline(s) before/after `of` in formatted code.
        repeat($.newline),
        field("of", $.kw_of),
        repeat($.newline),
        optional(field("lbrace", $.lbrace)),
        // Allow newline(s) after `{`
        repeat($.newline),
        // Allow blank lines between arms by permitting newlines between repetitions.
        seq($.lcase_arm, repeat(seq(repeat1($.newline), $.lcase_arm))),
        // Allow newline(s) before `}`
        repeat($.newline),
        optional(field("rbrace", $.rbrace)),
      ),

    lcase_arm: ($) =>
      choice(
        seq(
          field("bar", $.bar),
          field("nil", $.kw_nil),
          field("arrow", $.fat_arrow),
          // Allow newline(s) after `=>` for indented arm bodies.
          repeat($.newline),
          field("body", $.expr),
        ),
        seq(
          field("bar", $.bar),
          field("cons", $.kw_cons),
          field("head", $.term_identifier_or_hole),
          field("tail", $.term_identifier_or_hole),
          field("arrow", $.fat_arrow),
          repeat($.newline),
          field("body", $.expr),
        ),
      ),

    // ----------------------------------------------------------------------------
    // Core expression layers
    // ----------------------------------------------------------------------------

    // Internal atom expression used for application and infix parsing.
    //
    // This is intentionally restricted to constructs that cannot contain `let ... in ...`
    // or other keyword-led expressions. This restriction reduces ambiguous states
    // at token boundaries like `... 2 in ...`.
    _atom: ($) =>
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

    application: ($) =>
      prec.left(
        PREC.application,
        seq(
          field("function", $._atom),
          repeat1(field("argument", $.app_argument)),
        ),
      ),

    // Arguments can be term atoms or type primaries (for type application `TApp` surface forms).
    app_argument: ($) => choice($._atom, $.type_primary),

    // Prefix operator application at term level:
    //   OP e
    prefix_application: ($) =>
      prec.right(
        PREC.prefix,
        seq(
          field("operator", $.operator),
          field("argument", $.application_or_primary),
        ),
      ),

    // Generic infix operator chain at term level:
    //   e1 op e2 op e3 ...
    //
    // Note: We use `repeat` (not `repeat1`) so that an atom/application alone is
    // still a valid `infix_expression`, which helps `let x = 2 in ...` reduce the
    // value before encountering `kw_in`.
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

    application_or_primary: ($) => choice($.application, $._atom),

    // Term primaries:
    // Kept for compatibility with existing highlight queries and node names.
    // Internally, the expression grammar prefers `_atom`.
    term_primary: ($) => $._atom,

    term_parens: ($) =>
      seq(
        field("lparen", $.lparen),
        field("expr", $.expr),
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
            repeat(seq(field("comma", $.comma), field("tail", $.expr))),
            optional(field("trailing_comma", $.comma)),
          ),
        ),
        field("colon", $.colon),
        field("type", $.type),
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
          field("type", $.type),
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
    // Comments
    // ----------------------------------------------------------------------------
    comment: (_) => token(seq("//", /.*/)),

    // ----------------------------------------------------------------------------
    // Explicit punctuation/operator nodes (for highlighting without literal tokens)
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
    plus: (_) => token("+"),

    equals: (_) => token("="),

    newline: (_) => token(/\r?\n/),

    arrow: (_) => token("->"),

    fat_arrow: (_) => token("=>"),

    operator: (_) =>
      token(
        choice(
          // Allow `.` as an infix operator in terms (used for composition chains like `inc . double`).
          ".",
          "-",
          seq("-", /[^.>\s\w()\[\]{},:|=]/, /[^.\s\w()\[\]{},:|=]*/),
          /[^.\s\w()\[\]{},:|=|-][^.\s\w()\[\]{},:|=]*/,
        ),
      ),

    // ----------------------------------------------------------------------------
    // Keywords
    // ----------------------------------------------------------------------------
    // Give keywords higher precedence than identifiers so they never get tokenized
    // as `term_identifier`/`type_identifier` in ambiguous contexts.
    kw_import: (_) => token(prec(2, "import")),
    kw_fun: (_) => token(prec(2, "fun")),
    kw_forall: (_) => token(prec(2, "forall")),
    kw_Type: (_) => token(prec(2, "Type")),

    // Type constructors used in the upstream type parser.
    kw_List: (_) => token(prec(2, "List")),
    kw_IO: (_) => token(prec(2, "IO")),

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

    kw___print: (_) => token(prec(2, "__print")),
    kw___pure: (_) => token(prec(2, "__pure")),
    kw___bind: (_) => token(prec(2, "__bind")),
    kw___readline: (_) => token(prec(2, "__readline")),

    // ----------------------------------------------------------------------------
    // Built-in base types (upstream keywords)
    // ----------------------------------------------------------------------------
    kw_Boolean: (_) => token(prec(2, "Boolean")),
    kw_Integer: (_) => token(prec(2, "Integer")),
    kw_Character: (_) => token(prec(2, "Character")),
    kw_Unit: (_) => token(prec(2, "Unit")),
  },
});
