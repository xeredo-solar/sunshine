#!/bin/sh

set -euo pipefail

SYM="$1"

nix-instantiate --indirect --add-root "$SYM" "<nixpkgs/nixos>" -A system
