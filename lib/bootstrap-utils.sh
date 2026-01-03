#!/usr/bin/env bash
# Bootstrap Helper Utilities
# Generic reusable functions for installation and configuration

###################
# OUTPUT FUNCTIONS
###################

echo_header() {
    echo -e "\n\033[1;34m==>\033[0m \033[1m$1\033[0m"
}

echo_step() {
    echo -e "\033[1;32m-->\033[0m $1"
}

echo_error() {
    echo -e "\033[1;31mERROR:\033[0m $1"
}

echo_warning() {
    echo -e "\033[1;33mWARNING:\033[0m $1"
}

###################
# GENERIC HELPERS
###################

# Generic installation function with custom check and install commands
# Usage: install_if_missing "name" "check_command" "install_command"
install_if_missing() {
    local name="$1"
    local check_cmd="$2"
    local install_cmd="$3"
    
    if eval "$check_cmd" &>/dev/null; then
        echo_step "$name already installed, skipping"
        return 0
    fi
    
    echo_step "Installing $name"
    eval "$install_cmd"
}

# Append to file if not already present
# Usage: append_if_missing "search_string" "line_to_add" "file" [use_pattern]
# - If use_pattern is "true", searches for pattern (regex)
# - Otherwise, searches for exact string match
append_if_missing() {
    local search="$1"
    local line="$2"
    local file="$3"
    local use_pattern="${4:-false}"
    
    # Create file if it doesn't exist
    touch "$file"
    
    if [ "$use_pattern" = "true" ]; then
        # Pattern match (regex)
        if grep -q "$search" "$file" 2>/dev/null; then
            return 0
        fi
    else
        # Exact string match
        if grep -qF "$search" "$file" 2>/dev/null; then
            return 0
        fi
    fi
    
    echo "$line" >> "$file"
    echo_step "Added to $file"
}

###################
# PACKAGE MANAGEMENT
###################

# Map generic package names to distro-specific names
get_package_name() {
    local generic_name=$1
    
    case $generic_name in
        "fd-find")
            case $PKG_MANAGER in
                "pacman") echo "fd" ;;
                "apt") echo "fd-find" ;;
                "dnf"|"zypper") echo "fd-find" ;;
            esac
            ;;
        "build-essential")
            case $PKG_MANAGER in
                "pacman") echo "base-devel" ;;
                "apt") echo "build-essential" ;;
                "dnf") echo "make automake gcc gcc-c++ kernel-devel" ;;
                "zypper") echo "patterns-devel-base-devel_basis" ;;
            esac
            ;;
        "libssl-dev")
            case $PKG_MANAGER in
                "pacman") echo "openssl" ;;
                "apt") echo "libssl-dev" ;;
                "dnf") echo "openssl-devel" ;;
                "zypper") echo "libopenssl-devel" ;;
            esac
            ;;
        "clipboard")
            case $PKG_MANAGER in
                "pacman") echo "wl-clipboard" ;;
                "apt") echo "xclip" ;;
                *) echo "" ;;
            esac
            ;;
        *)
            echo "$generic_name"
            ;;
    esac
}

# Install a package using the package manager
install_package() {
    local generic_name="$1"
    local package=$(get_package_name "$generic_name")
    
    if [ -z "$package" ]; then
        echo_warning "No package mapping for '$generic_name' on $PKG_MANAGER"
        return 0
    fi
    
    install_if_missing \
        "$generic_name" \
        "dpkg -l $package 2>/dev/null | grep -q '^ii' || rpm -q $package 2>/dev/null || pacman -Q $package 2>/dev/null" \
        "$PKG_INSTALL $package"
}

###################
# ENVIRONMENT DETECTION
###################

detect_shell() {
    # Determine shell type
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_TYPE="zsh"
    elif [ -n "$SHELL" ] && [[ "$SHELL" == *"zsh"* ]]; then
        SHELL_TYPE="zsh"
    elif grep -q "$(whoami).*zsh" /etc/passwd 2>/dev/null; then
        SHELL_TYPE="zsh"
    elif command -v zsh >/dev/null 2>&1; then
        echo_step "Found zsh installed but not running in zsh session"
        read -p "Would you like to use zsh configuration? (Y/n): " use_zsh
        [[ "$use_zsh" =~ ^[Nn]$ ]] && SHELL_TYPE="bash" || SHELL_TYPE="zsh"
    else
        SHELL_TYPE="bash"
    fi
    
    # Determine config file location
    if [ "$SHELL_TYPE" = "zsh" ]; then
        if [ -n "$ZDOTDIR" ]; then
            SHELL_RC="$ZDOTDIR/.zshrc"
        elif [ -f "$HOME/.config/zsh/.zshrc" ]; then
            SHELL_RC="$HOME/.config/zsh/.zshrc"
            append_if_missing 'export ZDOTDIR="$HOME/.config/zsh"' \
                'export ZDOTDIR="$HOME/.config/zsh"' "$HOME/.zshenv"
        else
            SHELL_RC="$HOME/.zshrc"
        fi
    else
        if [ -f "$HOME/.config/bash/bashrc" ]; then
            SHELL_RC="$HOME/.config/bash/bashrc"
            append_if_missing '[ -f "$HOME/.config/bash/bashrc" ] && . "$HOME/.config/bash/bashrc"' \
                '[ -f "$HOME/.config/bash/bashrc" ] && . "$HOME/.config/bash/bashrc"' "$HOME/.bashrc"
        else
            SHELL_RC="$HOME/.bashrc"
        fi
    fi
    
    echo_step "Detected shell: $SHELL_TYPE (config: $SHELL_RC)"
    
    # Offer to change location
    echo "Current shell config location: $SHELL_RC"
    read -p "Use a different config location? (y/N): " change_rc
    if [[ "$change_rc" =~ ^[Yy]$ ]]; then
        read -p "Enter new config path: " new_rc
        if [ -n "$new_rc" ]; then
            mkdir -p "$(dirname "$new_rc")"
            SHELL_RC="$new_rc"
            echo_step "Using custom config: $SHELL_RC"
        fi
    fi
    
    # Ensure config file exists
    touch "$SHELL_RC"
    
    # Export for use in main script
    export SHELL_TYPE
    export SHELL_RC
}

detect_package_manager() {
    if command -v pacman &>/dev/null; then
        PKG_MANAGER="pacman"
        PKG_INSTALL="sudo pacman -S --noconfirm"
        PKG_UPDATE="sudo pacman -Syu --noconfirm"
        echo_step "Detected package manager: pacman (Arch-based)"
    elif command -v apt &>/dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="sudo apt install -y"
        PKG_UPDATE="sudo apt update && sudo apt upgrade -y"
        echo_step "Detected package manager: apt (Debian/Ubuntu-based)"
    elif command -v dnf &>/dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="sudo dnf install -y"
        PKG_UPDATE="sudo dnf update -y"
        echo_step "Detected package manager: dnf (Fedora/RHEL-based)"
    elif command -v zypper &>/dev/null; then
        PKG_MANAGER="zypper"
        PKG_INSTALL="sudo zypper install -y"
        PKG_UPDATE="sudo zypper update -y"
        echo_step "Detected package manager: zypper (openSUSE)"
    else
        echo_error "Unsupported package manager"
        exit 1
    fi
    
    # Export for use in main script
    export PKG_MANAGER
    export PKG_INSTALL
    export PKG_UPDATE
}
