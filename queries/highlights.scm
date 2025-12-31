; Highlight queries for stlcpp (STLC++).
;
; IMPORTANT:
; - Only reference node types that exist in the grammar.
; - Avoid literal-token patterns like ":" or "(" because Zed can reject them for
;   custom grammars and a single bad pattern can disable *all* highlighting.

; -----------------------------------------------------------------------------
; Comments
; -----------------------------------------------------------------------------
(comment) @comment

; -----------------------------------------------------------------------------
; Keywords (explicit keyword tokens from the grammar)
; -----------------------------------------------------------------------------
(kw_import) @keyword
(kw_fun) @keyword
(kw_forall) @keyword
(kw_Type) @keyword

(kw_let) @keyword
(kw_in) @keyword

(kw_if) @keyword
(kw_then) @keyword
(kw_else) @keyword

(kw_case) @keyword
(kw_lcase) @keyword
(kw_of) @keyword

(kw_nil) @keyword
(kw_cons) @keyword
(kw_inl) @keyword
(kw_inr) @keyword

; NOTE:
; The grammar file may define additional kw_* tokens, but only tokens that are
; *reachable from the grammar's rules* appear as node types. Keep this list to
; node types that actually exist, otherwise Tree-sitter/Zed can reject the whole
; query file.

(kw_true) @boolean
(kw_false) @boolean

(kw_panic) @keyword
(kw_trace) @keyword

(kw_infixl) @keyword
(kw_infixr) @keyword
(kw_prefix) @keyword

(kw___print) @function.builtin
(kw___pure) @function.builtin
(kw___bind) @function.builtin
(kw___readline) @function.builtin

; -----------------------------------------------------------------------------
; Identifiers
; -----------------------------------------------------------------------------
(term_identifier) @variable
(type_identifier) @type

; -----------------------------------------------------------------------------
; Numbers / literals
; -----------------------------------------------------------------------------
(integer) @number
(char_literal) @string
(string_literal) @string

; -----------------------------------------------------------------------------
; Operators
; -----------------------------------------------------------------------------
(operator) @operator
(arrow) @operator
(fat_arrow) @operator
(equals) @operator

; -----------------------------------------------------------------------------
; Punctuation / delimiters / brackets
; -----------------------------------------------------------------------------
(comma) @punctuation.delimiter
(colon) @punctuation.delimiter
(bar) @punctuation.delimiter

(lparen) @punctuation.bracket
(rparen) @punctuation.bracket
(lbrack) @punctuation.bracket
(rbrack) @punctuation.bracket
(lbrace) @punctuation.bracket
(rbrace) @punctuation.bracket

; -----------------------------------------------------------------------------
; Definitions (top-level)
; -----------------------------------------------------------------------------
; x : Type [x = Expr]
(declaration
  name: (term_identifier) @variable.definition
  name2: (term_identifier) @variable.definition)

(declaration
  name: (term_identifier) @variable.definition)

; x = Expr
(value_definition
  name: (term_identifier) @variable.definition)

; Type aliases: State : Type [State = TypeExpr]
(type_alias_declaration
  name: (type_identifier) @type.definition
  name2: (type_identifier) @type.definition)

(type_alias_declaration
  name: (type_identifier) @type.definition)

; -----------------------------------------------------------------------------
; Calls / application-like constructs (best-effort)
; -----------------------------------------------------------------------------
(application
  function: (_) @function.call)

(infix_expression
  operator: (operator) @operator)
