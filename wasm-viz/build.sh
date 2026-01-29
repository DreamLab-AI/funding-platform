#!/bin/bash
# Build script for WASM visualization library

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building funding-viz WASM module...${NC}"

# Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo -e "${YELLOW}wasm-pack not found. Installing...${NC}"
    cargo install wasm-pack
fi

# Build for web target with optimizations
echo -e "${GREEN}Running wasm-pack build...${NC}"
wasm-pack build \
    --target web \
    --out-dir ../frontend/src/wasm/pkg \
    --release \
    --scope funding-platform

# Optimize WASM binary size if wasm-opt is available
if command -v wasm-opt &> /dev/null; then
    echo -e "${GREEN}Optimizing WASM binary...${NC}"
    WASM_FILE="../frontend/src/wasm/pkg/funding_viz_bg.wasm"
    if [ -f "$WASM_FILE" ]; then
        wasm-opt -Os -o "$WASM_FILE.opt" "$WASM_FILE"
        mv "$WASM_FILE.opt" "$WASM_FILE"
    fi
else
    echo -e "${YELLOW}wasm-opt not found. Skipping binary optimization.${NC}"
fi

# Generate TypeScript declaration file
echo -e "${GREEN}Generating TypeScript types...${NC}"

# Clean up package.json that wasm-pack creates (we manage our own)
rm -f ../frontend/src/wasm/pkg/package.json
rm -f ../frontend/src/wasm/pkg/.gitignore

echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Output files:"
ls -lh ../frontend/src/wasm/pkg/*.wasm ../frontend/src/wasm/pkg/*.js ../frontend/src/wasm/pkg/*.d.ts 2>/dev/null || true
echo ""
echo -e "${GREEN}WASM module ready at: frontend/src/wasm/pkg/${NC}"
