#!/bin/sh

set -euo pipefail

nix-store --realise --max-jobs 0 --option builders "" "$@"
