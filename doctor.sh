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
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

if [ -d "$DOTFILES_DIR/.git" ]; then
    pass "Dotfiles repository found at $DOTFILES_DIR"
else
    fail "Dotfiles repository missing or not a git repo: $DOTFILES_DIR"
fi

for module in ghostty lazygit nvim opencode starship tmux zsh; do
    check_symlink "$DOTFILES_DIR/$module" "$CONFIG_DIR/$module"
done

if [ -d "$DOTFILES_DIR/pi/agent" ]; then
    for pi_item in settings.json local-llms.example.json extensions themes; do
        check_symlink "$DOTFILES_DIR/pi/agent/$pi_item" "$PI_AGENT_DIR/$pi_item"
    done

    if [ -e "$DOTFILES_DIR/pi/agent/local-llms.json" ]; then
        check_symlink "$DOTFILES_DIR/pi/agent/local-llms.json" "$PI_AGENT_DIR/local-llms.json"
    elif [ -e "$PI_AGENT_DIR/local-llms.json" ]; then
        warn "$PI_AGENT_DIR/local-llms.json exists but is local-only; copy from local-llms.example.json if needed"
    else
        warn "Pi local LLM config is not set up; copy $DOTFILES_DIR/pi/agent/local-llms.example.json to $DOTFILES_DIR/pi/agent/local-llms.json"
    fi
fi

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

if command -v nvim >/dev/null 2>&1; then
    nvim_version="$(nvim --version | head -n1 | awk '{print $2}' | sed 's/^v//')"
    if [ "$(printf '%s\n%s\n' "0.12.0" "$nvim_version" | sort -V | head -n1)" = "0.12.0" ]; then
        pass "Neovim version satisfies >= 0.12.0 ($nvim_version)"
    else
        warn "Neovim version is $nvim_version; nvim config requires >= 0.12.0"
    fi
fi

if command -v tree-sitter >/dev/null 2>&1; then
    pass "Command available: tree-sitter ($(tree-sitter --version))"
else
    warn "Command missing: tree-sitter (required by current nvim-treesitter)"
fi

for optional_cmd in ghostty starship zoxide lazygit opencode pi; do
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
