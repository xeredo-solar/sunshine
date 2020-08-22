#!/bin/sh

set -euo pipefail

exec nix-channel --update -vv
