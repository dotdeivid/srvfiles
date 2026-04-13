#!/bin/bash
# build-sidecar.sh — Compila el backend Go en un binario nativo para el sidecar de Tauri.
# Uso: bash scripts/build-sidecar.sh
# Se ejecuta automáticamente via "npm run build:sidecar".

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
EMBED_DIR="$BACKEND_DIR/cmd/server/frontend/dist"

echo "==> [1/4] Detectando target triple..."
# Ensure Rust is in PATH (rustup installs to ~/.cargo/bin)
export PATH="$HOME/.cargo/bin:$PATH"
TARGET_TRIPLE=$(rustc -Vv | grep "^host:" | cut -d' ' -f2)
echo "    Target: $TARGET_TRIPLE"

# Mapear target triple de Rust al par GOOS/GOARCH
case "$TARGET_TRIPLE" in
  "aarch64-apple-darwin")      GOOS=darwin;  GOARCH=arm64 ;;
  "x86_64-apple-darwin")       GOOS=darwin;  GOARCH=amd64 ;;
  "x86_64-pc-windows-msvc")    GOOS=windows; GOARCH=amd64 ;;
  "x86_64-unknown-linux-gnu")  GOOS=linux;   GOARCH=amd64 ;;
  "aarch64-unknown-linux-gnu") GOOS=linux;   GOARCH=arm64 ;;
  *) echo "ERROR: Target no soportado: $TARGET_TRIPLE"; exit 1 ;;
esac

echo "==> [2/4] Compilando frontend..."
cd "$ROOT_DIR/frontend"
npm run build

echo "==> [3/4] Copiando frontend al directorio de embed..."
mkdir -p "$EMBED_DIR"
cp -r "$ROOT_DIR/frontend/dist/." "$EMBED_DIR/"

echo "==> [4/4] Compilando backend Go (con frontend embebido)..."
mkdir -p "$ROOT_DIR/src-tauri/binaries"

SIDECAR_NAME="srvfiles-sidecar-${TARGET_TRIPLE}"
OUTPUT_PATH="$ROOT_DIR/src-tauri/binaries/$SIDECAR_NAME"

if [[ "$GOOS" == "windows" ]]; then
  OUTPUT_PATH="${OUTPUT_PATH}.exe"
fi

cd "$BACKEND_DIR"
GOOS=$GOOS GOARCH=$GOARCH go build \
  -tags embed \
  -ldflags="-s -w" \
  -o "$OUTPUT_PATH" \
  ./cmd/server

# Limpiar el directorio de embed después de compilar
rm -rf "$BACKEND_DIR/cmd/server/frontend"

echo ""
echo "✅ Sidecar generado: src-tauri/binaries/$SIDECAR_NAME"
echo "   Tamaño: $(du -sh "$OUTPUT_PATH" | cut -f1)"
