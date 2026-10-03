#!/usr/bin/env bash
set -euo pipefail

# Seamless Ctrl+h/j/k/l navigation for Herdr + Neovim without a Herdr plugin.
#
# Herdr binds Ctrl+h/j/k/l to this script. If the focused Herdr pane is running
# Vim/Neovim, forward the key into that pane so Neovim can move between splits
# first. If Neovim is already at an edge, the Neovim mapping calls
# `herdr pane focus` to cross into the neighboring Herdr pane. For non-editor
# panes, this script focuses the neighboring Herdr pane directly.

if [ "$#" -ne 2 ]; then
    echo "usage: $0 <left|down|up|right> <ctrl+h|ctrl+j|ctrl+k|ctrl+l>" >&2
    exit 2
fi

direction="$1"
key="$2"
herdr_bin="${HERDR_BIN_PATH:-herdr}"
pane_id="${HERDR_ACTIVE_PANE_ID:-${HERDR_PANE_ID:-}}"

if [ -z "$pane_id" ]; then
    exit 0
fi

process_info="$($herdr_bin pane process-info --pane "$pane_id" 2>/dev/null || true)"

is_editor=false
if [ -n "$process_info" ]; then
    if PROCESS_INFO="$process_info" python3 - <<'PY'
import json
import os
import re
import shlex
import sys

text = os.environ.get("PROCESS_INFO", "")
pattern = re.compile(r"^(g?\.?n?vim|vim|view|l?n?vimx?|fzf)(diff)?(-wrapped)?$", re.I)

try:
    data = json.loads(text)
except Exception:
    names = re.findall(r"[A-Za-z0-9_.+-]+", text)
else:
    names = []

    def walk(value):
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str):
            names.append(value)

    walk(data)

for value in names:
    for part in shlex.split(value) if isinstance(value, str) else []:
        name = os.path.basename(part).lower()
        if pattern.match(name):
            sys.exit(0)

sys.exit(1)
PY
    then
        is_editor=true
    fi
fi

if [ "$is_editor" = true ]; then
    exec "$herdr_bin" pane send-keys "$pane_id" "$key"
fi

exec "$herdr_bin" pane focus --direction "$direction" --pane "$pane_id"
