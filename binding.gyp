{
  "targets": [
    {
      "target_name": "tree_sitter_stlcpp_binding",
      "type": "static_library",
      "cflags_c": ["-std=c11"],
      "include_dirs": [
        "src"
      ],
      "sources": [
        "src/parser.c"
      ],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": { "AdditionalOptions": ["/std:c11"] }
          }
        }]
      ]
    }
  ]
}
