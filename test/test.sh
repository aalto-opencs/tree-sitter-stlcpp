#!/usr/bin/env bash
# Test runner for tree-sitter-stlcpp grammar

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0
errors=()

echo "Running tree-sitter-stlcpp grammar tests..."
echo "============================================"
echo

# Check if tree-sitter is available
if ! command -v tree-sitter &> /dev/null; then
    echo -e "${RED}Error: tree-sitter command not found${NC}"
    echo "Please install tree-sitter CLI"
    exit 1
fi

# Run parser on each fixture
for fixture in "$FIXTURES_DIR"/*.stlc; do
    if [ ! -f "$fixture" ]; then
        echo -e "${YELLOW}No test fixtures found${NC}"
        exit 0
    fi

    filename=$(basename "$fixture")
    printf "Testing %-30s ... " "$filename"

    # Run tree-sitter parse and capture output
    if output=$(tree-sitter parse "$fixture" 2>&1); then
        # Check for ERROR nodes in the output
        if echo "$output" | grep -q "(ERROR"; then
            echo -e "${RED}FAIL (parse errors)${NC}"
            errors+=("$filename: Contains ERROR nodes")
            failed=$((failed + 1))
        else
            echo -e "${GREEN}PASS${NC}"
            passed=$((passed + 1))
        fi
    else
        echo -e "${RED}FAIL (parse failed)${NC}"
        errors+=("$filename: Parse command failed")
        failed=$((failed + 1))
    fi
done

echo
echo "============================================"
echo "Results: $passed passed, $failed failed"
echo

# Print error details if any
if [ $failed -gt 0 ]; then
    echo "Failures:"
    for error in "${errors[@]}"; do
        echo -e "  ${RED}✗${NC} $error"
    done
    echo
    exit 1
fi

echo -e "${GREEN}All tests passed!${NC}"
exit 0
