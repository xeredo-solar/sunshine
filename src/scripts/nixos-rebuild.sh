#!/bin/sh

set -euo pipefail

OP="$1"

LC_ALL=C nixos-rebuild "$OP"
