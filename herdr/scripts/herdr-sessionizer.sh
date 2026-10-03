#!/usr/bin/env bash
set -euo pipefail

# Herdr equivalent of tmux-sessionizer.
# Pick a project directory with fzf, then focus an existing Herdr workspace with
# the same label or create a new workspace rooted at that directory.

if [[ $# -eq 1 ]]; then
    selected="$1"
else
    candidates=(
        "$HOME/Desktop"
        "$HOME/Desktop/projects"
        "$HOME/Desktop/work"
        "$HOME/Desktop/personal"
        "$HOME/Desktop/playground"
        "$HOME/.config"
        "$HOME/dotfiles"
        "$HOME"
    )

    existing=()
    for dir in "${candidates[@]}"; do
        [[ -d "$dir" ]] && existing+=("$dir")
    done

    if [[ ${#existing[@]} -eq 0 ]]; then
        echo "No candidate directories found" >&2
        exit 1
    fi

    selected="$(find "${existing[@]}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -u | fzf --prompt='Herdr workspace> ')"
fi

if [[ -z "${selected:-}" ]]; then
    exit 0
fi

selected="$(realpath "$selected")"
selected_name="$(basename "$selected" | tr . _)"

if ! command -v herdr >/dev/null 2>&1; then
    echo "herdr not found" >&2
    exit 1
fi

workspace_id="$({ herdr workspace list || true; } | SELECTED_NAME="$selected_name" python3 - <<'PY'
import json
import os
import sys

wanted = os.environ["SELECTED_NAME"]
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

for workspace in data.get("result", {}).get("workspaces", []):
    if workspace.get("label") == wanted:
        print(workspace.get("workspace_id", ""))
        break
PY
)"

if [[ -n "$workspace_id" ]]; then
    herdr workspace focus "$workspace_id" >/dev/null
else
    herdr workspace create --cwd "$selected" --label "$selected_name" --focus >/dev/null
fi
