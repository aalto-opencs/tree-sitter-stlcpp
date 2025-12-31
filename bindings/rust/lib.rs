//! Rust bindings for the `tree-sitter-stlcpp` grammar.
//!
//! This follows the standard layout used by Tree-sitter grammars so that
//! consumers (including Zed, via its grammar build pipeline) can link the
//! generated parser and obtain a `tree_sitter::Language` handle.

use tree_sitter::Language;

extern "C" {
    fn tree_sitter_stlcpp() -> Language;
}

/// Returns the Tree-sitter [`Language`] for this grammar.
pub fn language() -> Language {
    unsafe { tree_sitter_stlcpp() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grammar_can_be_loaded() {
        let _ = language();
    }
}
