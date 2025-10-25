#!/usr/bin/env bash
set -e

# ========= Helper Functions =========
echo_step() { echo -e "\033[1;32m-->\033[0m $1"; }
echo_error() { echo -e "\033[1;31mERROR:\033[0m $1"; }

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

# Create ~/.zshenv
cat > "$HOME/.zshenv" <<'EOF'
# Set ZDOTDIR to use config in ~/.config/zsh
export ZDOTDIR="$HOME/.config/zsh"
EOF

# Create ~/.zprofile
cat > "$HOME/.zprofile" <<'EOF'
# Set ZDOTDIR to use config in ~/.config/zsh
export ZDOTDIR="$HOME/.config/zsh"
EOF

echo_step "ZSH configuration files created at ~/.config/zsh"

# ========= Change Default Shell =========
CURRENT_SHELL=$(basename "$SHELL")
if [[ "$CURRENT_SHELL" != "zsh" ]]; then
    ZSH_PATH=$(command -v zsh)
    if [[ -n "$ZSH_PATH" ]]; then
        echo_step "Changing default shell to ZSH..."
        sudo chsh -s "$ZSH_PATH" "$USER"
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

