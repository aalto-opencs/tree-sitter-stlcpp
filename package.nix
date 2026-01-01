{ lib
, stdenv
, tree-sitter
, nodejs
}:

stdenv.mkDerivation {
  pname = "tree-sitter-stlcpp";
  version = "0.1.0";

  src = ./.;

  checkInputs = [
    tree-sitter
    nodejs  # Required for tree-sitter test
  ];

  # No configure phase needed - src/ is committed to the repository

  buildPhase = ''
    runHook preBuild

    # Compile the parser from committed src/parser.c
    echo "Compiling parser..."
    $CC -fPIC -c src/parser.c -o parser.o -I src

    # Create shared library
    echo "Creating shared library..."
    $CC -shared parser.o -o parser.so

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/parser
    cp parser.so $out/parser/stlcpp.so

    # Install grammar files for tooling
    mkdir -p $out/share/tree-sitter-stlcpp
    cp -r queries $out/share/tree-sitter-stlcpp/ 2>/dev/null || true
    cp grammar.js $out/share/tree-sitter-stlcpp/
    cp src/grammar.json $out/share/tree-sitter-stlcpp/
    cp src/node-types.json $out/share/tree-sitter-stlcpp/

    runHook postInstall
  '';

  # Run tests using the test script
  doCheck = true;
  checkPhase = ''
    runHook preCheck

    # Set up tree-sitter to find our parser
    export TREE_SITTER_LIBDIR=$PWD

    # Create a minimal tree-sitter config pointing to our parser
    mkdir -p .tree-sitter
    cat > .tree-sitter/config.json << EOF
{
  "parser-directories": [
    "$PWD"
  ]
}
EOF
    export HOME=$PWD

    # Create parser directory structure expected by tree-sitter
    mkdir -p tree-sitter-stlcpp
    ln -s $PWD/parser.so tree-sitter-stlcpp/stlcpp.so

    # Run tree-sitter tests
    tree-sitter test

    runHook postCheck
  '';
}
