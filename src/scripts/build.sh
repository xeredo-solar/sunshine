#!/bin/sh

set -euo pipefail

LC_ALL=C nix-build "$@"
