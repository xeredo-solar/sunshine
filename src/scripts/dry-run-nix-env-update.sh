#!/bin/sh

set -euo pipefail

OUT="$1"

nix-env --dry-run -u > "$OUT" 2>&1
