#!/bin/sh

LOC="$1"
FIELD="$2"
OUT="$3"

LC_ALL=C df "$LOC" "--output=$FIELD" | tail -n 1 > "$OUT"
