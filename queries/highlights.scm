; Highlight queries for stlcpp (STLC++).

; Comments
(comment) @comment

; Keywords
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

; Identifiers
(term_identifier) @variable
(type_identifier) @type

; Literals
(integer) @number
(char_literal) @string
(string_literal) @string

; Operators
(operator) @operator
(arrow) @operator
(fat_arrow) @operator
(equals) @operator
(plus) @operator

; Punctuation / delimiters / brackets
(comma) @punctuation.delimiter
(colon) @punctuation.delimiter
(bar) @punctuation.delimiter

(lparen) @punctuation.bracket
(rparen) @punctuation.bracket
(lbrack) @punctuation.bracket
(rbrack) @punctuation.bracket
(lbrace) @punctuation.bracket
(rbrace) @punctuation.bracket

; Definitions (top-level)
(declaration
  name: (term_identifier) @variable.definition
  name2: (term_identifier) @variable.definition)

(declaration
  name: (term_identifier) @variable.definition)

(value_definition
  name: (term_identifier) @variable.definition)

; Type aliases
(type_alias_declaration
  name: (type_identifier) @type.definition
  name2: (type_identifier) @type.definition)

(type_alias_declaration
  name: (type_identifier) @type.definition)

; Calls / application
(application
  function: (_) @function.call)

(infix_expression
  operator: (operator) @operator)
