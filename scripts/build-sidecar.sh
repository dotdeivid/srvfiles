#!/bin/bash
# build-sidecar.sh — Compila el backend en un binario nativo para el sidecar de Tauri.
# Uso: bash scripts/build-sidecar.sh
# Se ejecuta automáticamente via "npm run build:sidecar".

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/4] Detectando target triple..."
# Ensure Rust is in PATH (rustup installs to ~/.cargo/bin)
export PATH="$HOME/.cargo/bin:$PATH"
TARGET_TRIPLE=$(rustc -Vv | grep "^host:" | cut -d' ' -f2)
echo "    Target: $TARGET_TRIPLE"

# Mapear target triple de Rust al formato de pkg
case "$TARGET_TRIPLE" in
  "aarch64-apple-darwin")    PKG_TARGET="node20-macos-arm64" ;;
  "x86_64-apple-darwin")     PKG_TARGET="node20-macos-x64"   ;;
  "x86_64-pc-windows-msvc")  PKG_TARGET="node20-win-x64"     ;;
  "x86_64-unknown-linux-gnu") PKG_TARGET="node20-linux-x64"  ;;
  "aarch64-unknown-linux-gnu") PKG_TARGET="node20-linux-arm64" ;;
  *) echo "ERROR: Target no soportado: $TARGET_TRIPLE"; exit 1 ;;
esac

echo "==> [2/4] Compilando frontend..."
cd "$ROOT_DIR/frontend"
npm run build

echo "==> [3/4] Compilando backend TypeScript..."
cd "$ROOT_DIR/backend"
npm run build

echo "==> [4/4] Empaquetando sidecar con pkg..."
mkdir -p "$ROOT_DIR/src-tauri/binaries"

SIDECAR_NAME="srvfiles-sidecar-${TARGET_TRIPLE}"

# Nombre del output (en Windows agrega .exe)
OUTPUT_PATH="$ROOT_DIR/src-tauri/binaries/$SIDECAR_NAME"

cd "$ROOT_DIR/backend"
npx @yao-pkg/pkg dist/index.js \
  --config package.json \
  --targets "$PKG_TARGET" \
  --output "$OUTPUT_PATH"

# En Windows, pkg agrega .exe automáticamente
if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
  OUTPUT_PATH="${OUTPUT_PATH}.exe"
fi

echo ""
echo "✅ Sidecar generado: src-tauri/binaries/$SIDECAR_NAME"
echo "   Tamaño: $(du -sh "$OUTPUT_PATH" | cut -f1)"
