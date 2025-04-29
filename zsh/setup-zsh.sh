#!/bin/bash

echo "Setting up ZSH..."

echo_step() {
    echo -e "\033[1;32m-->\033[0m $1"
}
echo_error() {
    echo -e "\033[1;31mERROR:\033[0m $1"
}

# Detect package manager
detect_package_manager() {
    if command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        PKG_INSTALL="sudo pacman -S --noconfirm"
        PKG_UPDATE="sudo pacman -Syu"
        echo_step "Detected package manager: pacman (Arch-based)"
    elif command -v apt &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="sudo apt install -y"
        PKG_UPDATE="sudo apt update && sudo apt upgrade -y"
        echo_step "Detected package manager: apt (Debian/Ubuntu-based)"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="sudo dnf install -y"
        PKG_UPDATE="sudo dnf update -y"
        echo_step "Detected package manager: dnf (Fedora/RHEL-based)"
    elif command -v zypper &> /dev/null; then
        PKG_MANAGER="zypper"
        PKG_INSTALL="sudo zypper install -y"
        PKG_UPDATE="sudo zypper update -y"
        echo_step "Detected package manager: zypper (openSUSE)"
    else
        echo_error "Unsupported package manager"
        exit 1
    fi
}

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
        # Add more package mappings as needed
        *)
            echo "$generic_name"
            ;;
    esac
}

install_package() {
    local package=$(get_package_name "$1")
    echo_step "Installing package: $package"
    $PKG_INSTALL $package
}


# Install zsh if not already installed
if ! command -v zsh &> /dev/null; then
    echo "Installing zsh..."
    install_package "zsh"
else
    echo "ZSH is already installed."
fi

## Create both .zshenv and .zprofile to ensure ZDOTDIR is set properly
echo "Creating zsh configuration files..."
### Create .zshenv (will work for most scenarios)
cat > "$HOME/.zshenv" << EOL
# Set ZDOTDIR to use config in ~/.config/zsh
export ZDOTDIR="\$HOME/.config/zsh"
EOL
### Create .zprofile (useful for Arch Linux login shells)
cat > "$HOME/.zprofile" << EOL
# Set ZDOTDIR to use config in ~/.config/zsh
export ZDOTDIR="\$HOME/.config/zsh"
EOL

## Change default shell to zsh
echo "Changing default shell to zsh..."
chsh -s "$(which zsh)"

echo "ZSH setup complete! Please log out and log back in for changes to take effect."
echo "Your ZSH configuration will be loaded from ~/.config/zsh/.zshrc"