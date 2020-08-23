#!/bin/sh

set -euo pipefail

IN="$1"
OUT="$2"

LC_ALL=C nix-build --dry-run "$IN" > "$OUT" 2>&1
