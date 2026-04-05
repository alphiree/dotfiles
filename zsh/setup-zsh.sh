#!/usr/bin/env bash
set -euo pipefail

NON_INTERACTIVE=false
CHANGE_DEFAULT_SHELL=true

usage() {
    cat <<'EOF'
Usage: setup-zsh.sh [options]

Options:
  --yes, --non-interactive  Run without prompts
  --no-chsh                 Do not change default shell
  -h, --help                Show this help message
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes|--non-interactive)
                NON_INTERACTIVE=true
                ;;
            --no-chsh)
                CHANGE_DEFAULT_SHELL=false
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
        shift
    done
}

# ========= Helper Functions =========
echo_step() { echo -e "\033[1;32m-->\033[0m $1"; }
echo_error() { echo -e "\033[1;31mERROR:\033[0m $1"; }

append_if_missing() {
    local line="$1"
    local file="$2"
    touch "$file"
    if ! grep -qF "$line" "$file" 2>/dev/null; then
        printf '%s\n' "$line" >> "$file"
    fi
}

parse_args "$@"

# ========= Detect Package Manager =========
OS="$(uname -s)"
PKG_MANAGER=""
PKG_INSTALL=""
PKG_UPDATE=""

if [[ "$OS" == "Darwin" ]]; then
    PKG_MANAGER="brew"
    PKG_INSTALL="brew install"
    PKG_UPDATE="brew update"
elif command -v pacman >/dev/null 2>&1; then
    PKG_MANAGER="pacman"
    PKG_INSTALL="sudo pacman -S --noconfirm"
    PKG_UPDATE="sudo pacman -Syu"
elif command -v apt >/dev/null 2>&1; then
    PKG_MANAGER="apt"
    PKG_INSTALL="sudo apt install -y"
    PKG_UPDATE="sudo apt update && sudo apt upgrade -y"
elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
    PKG_INSTALL="sudo dnf install -y"
    PKG_UPDATE="sudo dnf update -y"
elif command -v zypper >/dev/null 2>&1; then
    PKG_MANAGER="zypper"
    PKG_INSTALL="sudo zypper install -y"
    PKG_UPDATE="sudo zypper update -y"
else
    echo_error "Unsupported package manager. Please install zsh manually."
    exit 1
fi

echo_step "Detected package manager: $PKG_MANAGER"

if [[ "$PKG_MANAGER" == "brew" ]] && ! command -v brew >/dev/null 2>&1; then
    echo_error "Homebrew is required on macOS. Install it first: https://brew.sh"
    exit 1
fi

# ========= Install ZSH =========
if ! command -v zsh >/dev/null 2>&1; then
    echo_step "Installing ZSH..."
    $PKG_INSTALL zsh
else
    echo_step "ZSH is already installed."
fi

# ========= Configure ZSH =========
echo_step "Setting up ZSH configuration..."
mkdir -p "$HOME/.config/zsh"

append_if_missing 'export ZDOTDIR="$HOME/.config/zsh"' "$HOME/.zshenv"
append_if_missing 'export ZDOTDIR="$HOME/.config/zsh"' "$HOME/.zprofile"

echo_step "ZSH configuration files created at ~/.config/zsh"

# ========= Change Default Shell =========
CURRENT_SHELL=$(basename "$SHELL")
if [[ "$CHANGE_DEFAULT_SHELL" = false ]]; then
    echo_step "Skipping default shell change (--no-chsh)"
elif [[ "$CURRENT_SHELL" != "zsh" ]]; then
    ZSH_PATH=$(command -v zsh)
    if [[ -n "$ZSH_PATH" ]]; then
        if [[ "$NON_INTERACTIVE" = true ]]; then
            echo_step "Changing default shell to ZSH..."
            chsh -s "$ZSH_PATH" "$USER" || echo_error "Could not change default shell automatically"
        else
            read -r -p "Change default shell to zsh now? (Y/n): " should_change
            if [[ ! "$should_change" =~ ^[Nn]$ ]]; then
                chsh -s "$ZSH_PATH" "$USER" || echo_error "Could not change default shell automatically"
            else
                echo_step "Skipped changing default shell"
            fi
        fi
    else
        echo_error "Unable to find zsh binary path."
    fi
else
    echo_step "Default shell is already ZSH."
fi

# ========= Done =========
echo_step "ZSH setup complete!"
echo "Please log out and log back in for changes to take effect."
echo "Your ZSH configuration will load from: ~/.config/zsh/.zshrc"
