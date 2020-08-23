#!/bin/sh

set -euo pipefail

OUT="$1"

nix-instantiate "<nixpkgs/nixos>" -A system > "$OUT"
