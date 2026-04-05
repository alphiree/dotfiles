#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    echo -e "${GREEN}[PASS]${NC} $1"
}

warn() {
    WARN_COUNT=$((WARN_COUNT + 1))
    echo -e "${YELLOW}[WARN]${NC} $1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo -e "${RED}[FAIL]${NC} $1"
}

check_symlink() {
    local source="$1"
    local target="$2"

    if [ ! -e "$target" ] && [ ! -L "$target" ]; then
        fail "$target is missing"
        return
    fi

    if [ -L "$target" ]; then
        local current
        current="$(readlink "$target" || true)"
        if [ "$current" = "$source" ]; then
            pass "$target links to $source"
        else
            warn "$target links to $current (expected $source)"
        fi
    else
        warn "$target exists but is not a symlink"
    fi
}

echo -e "${BLUE}==>${NC} Dotfiles doctor"

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dotfiles}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config}"

if [ -d "$DOTFILES_DIR/.git" ]; then
    pass "Dotfiles repository found at $DOTFILES_DIR"
else
    fail "Dotfiles repository missing or not a git repo: $DOTFILES_DIR"
fi

for module in kitty lazygit nvim opencode starship tmux zsh; do
    check_symlink "$DOTFILES_DIR/$module" "$CONFIG_DIR/$module"
done

if [ -f "$CONFIG_DIR/zsh/.zshrc" ]; then
    if grep -Eq '/home/[A-Za-z0-9_.-]+|/Users/[A-Za-z0-9_.-]+' "$CONFIG_DIR/zsh/.zshrc"; then
        warn "zsh config contains user-specific absolute paths"
    else
        pass "zsh config avoids user-specific absolute paths"
    fi
else
    warn "zsh config file not found at $CONFIG_DIR/zsh/.zshrc"
fi

for cmd in git nvim tmux; do
    if command -v "$cmd" >/dev/null 2>&1; then
        pass "Command available: $cmd"
    else
        warn "Command missing: $cmd"
    fi
done

for optional_cmd in starship zoxide lazygit opencode; do
    if command -v "$optional_cmd" >/dev/null 2>&1; then
        pass "Optional command available: $optional_cmd"
    else
        warn "Optional command missing: $optional_cmd"
    fi
done

echo
echo -e "${BLUE}==>${NC} Result: ${PASS_COUNT} passed, ${WARN_COUNT} warnings, ${FAIL_COUNT} failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
