#!/bin/sh

set -euo pipefail

SYM="$1"
shift

LC_ALL=C nix-build --out-link "$SYM" "$@"
