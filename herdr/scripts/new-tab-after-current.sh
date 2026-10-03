#!/usr/bin/env bash
set -euo pipefail

# Create a Herdr tab immediately and place it after the currently focused tab.
# This gives prefix+c tmux-like `new-window -a` behavior without Herdr's
# tab-name popup.

if ! command -v jq >/dev/null 2>&1; then
  echo "new-tab-after-current: jq is required" >&2
  exit 1
fi

if ! command -v socat >/dev/null 2>&1; then
  echo "new-tab-after-current: socat is required" >&2
  exit 1
fi

socket=$(
  herdr status server 2>/dev/null \
    | awk -F': ' '$1 == "socket" { print $2; exit }'
)

if [[ -z "${socket:-}" || ! -S "$socket" ]]; then
  echo "new-tab-after-current: Herdr server socket not found" >&2
  exit 1
fi

snapshot=$(herdr api snapshot)
workspace_id=$(jq -r '.result.snapshot.focused_workspace_id // empty' <<<"$snapshot")
current_tab_id=$(jq -r '.result.snapshot.focused_tab_id // empty' <<<"$snapshot")

if [[ -z "$workspace_id" || -z "$current_tab_id" ]]; then
  echo "new-tab-after-current: no focused Herdr workspace/tab found" >&2
  exit 1
fi

current_index=$(
  jq -r --arg ws "$workspace_id" --arg tab "$current_tab_id" '
    [.result.snapshot.tabs[] | select(.workspace_id == $ws)]
    | map(.tab_id)
    | index($tab)
  ' <<<"$snapshot"
)

if [[ "$current_index" == "null" || -z "$current_index" ]]; then
  echo "new-tab-after-current: focused tab not found in workspace" >&2
  exit 1
fi

created=$(herdr tab create --workspace "$workspace_id" --focus)
new_tab_id=$(jq -r '.result.tab.tab_id // empty' <<<"$created")

if [[ -z "$new_tab_id" ]]; then
  echo "new-tab-after-current: failed to create tab" >&2
  exit 1
fi

insert_index=$((current_index + 1))
request=$(
  jq -cn \
    --arg tab_id "$new_tab_id" \
    --argjson insert_index "$insert_index" \
    '{id:"new-tab-after-current:move", method:"tab.move", params:{tab_id:$tab_id, insert_index:$insert_index}}'
)

printf '%s\n' "$request" \
  | socat - "UNIX-CONNECT:$socket" \
  | jq -e 'has("result")' >/dev/null

herdr tab focus "$new_tab_id" >/dev/null
