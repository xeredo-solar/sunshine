#!/bin/sh

params=()

if [ ! -z "$KEEP_COUNT" ]; then
  params+=("--delete-older-than" "${KEEP_COUNT}d"
else
  params+=("--delete-old")
fi

set -euo pipefail

exec nix-collect-garbage "${params[@]}"
