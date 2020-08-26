#!/bin/sh

set -euo pipefail

SYM="$1"
shift

nix-store --indirect --add-root "$SYM" --realise --max-jobs 0 --option builders "" "$@"
