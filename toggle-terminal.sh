#!/usr/bin/env bash
#
# toggle-terminal.sh
#   – On Wayland: toggle (minimize/restore) Kitty via kdotool
#       - For arch-linux: make sure to install `yay` first then install kdotool
#       - yay -S kdotool
#   – On X11:     toggle (minimize/restore) Kitty via xdotool + xprop

# ──── Configuration ────────────────────────────────────────────────────────────

# The terminal command to launch if none is running:
TERM_CMD="kitty"
# The window class to search for:
TERM_CLASS="kitty"

# ──── Wayland Backend ─────────────────────────────────────────────────────────

toggle_wayland() {
    # Requires: kdotool
    # Find one Kitty window
    local win
    win=$(kdotool search --class "$TERM_CLASS" --limit 1 | head -n1)

    if [[ -n "$win" ]]; then
        # If it's focused, minimize; else, activate (which also restores + focuses)
        if [[ "$(kdotool getactivewindow)" == "$win" ]]; then
            kdotool windowminimize "$win"
        else
            kdotool windowactivate "$win"
        fi
    else
        # Launch a new Kitty
        "$TERM_CMD" &
    fi
}

# ──── X11 Backend ──────────────────────────────────────────────────────────────

toggle_x11() {
    # Requires: xdotool, xprop
    # Get the first visible Kitty window ID
    local win_id minimized

    win_id=$(xdotool search --onlyvisible --class "$TERM_CLASS" 2>/dev/null | head -n1)

    if [[ -n "$win_id" ]]; then
        # Check if it's hidden (minimized)
        minimized=$(xprop -id "$win_id" _NET_WM_STATE | grep -c HIDDEN)

        if (( minimized > 0 )); then
            xdotool windowactivate "$win_id"
        else
            xdotool windowminimize "$win_id"
        fi
    else
        # Launch a new Kitty
        "$TERM_CMD" &
    fi
}

# ──── Main Dispatch ────────────────────────────────────────────────────────────

# Detect session type: Wayland vs X11
# Fallback: if XDG_SESSION_TYPE is unset, assume X11
case "${XDG_SESSION_TYPE:-x11}" in
    wayland)    toggle_wayland   ;;
    x11|*)      toggle_x11       ;;
esac


