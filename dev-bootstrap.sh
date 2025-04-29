#!/usr/bin/env bash
# Exit on error
set -e

###################
# HELPER FUNCTIONS
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
###################
# DETECT ENVIRONMENT
###################
# Detect shell
# Old version (commented out properly)
# detect_shell() {
#     if [ -n "$ZSH_VERSION" ]; then
#         SHELL_TYPE="zsh"
#         SHELL_RC="$HOME/.zshrc"
#     else
#         SHELL_TYPE="bash"
#         SHELL_RC="$HOME/.bashrc"
#     fi
#     echo_step "Detected shell: $SHELL_TYPE (config: $SHELL_RC)"
# }

# Improved shell detection function
detect_shell() {
    # First determine which shell we're running
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_TYPE="zsh"
        
        # Check if ZDOTDIR is set (custom Zsh config location)
        if [ -n "$ZDOTDIR" ]; then
            SHELL_RC="$ZDOTDIR/.zshrc"
        # Check if XDG config exists
        elif [ -f "$HOME/.config/zsh/.zshrc" ]; then
            SHELL_RC="$HOME/.config/zsh/.zshrc"
            # Also update ZDOTDIR for future reference
            echo 'export ZDOTDIR="$HOME/.config/zsh"' >> $HOME/.zshenv
        # Fall back to default location
        else
            SHELL_RC="$HOME/.zshrc"
        fi
    else
        SHELL_TYPE="bash"
        
        # Check if XDG config exists
        if [ -f "$HOME/.config/bash/bashrc" ]; then
            SHELL_RC="$HOME/.config/bash/bashrc"
            # Ensure .bashrc sources the XDG config
            echo '[ -f "$HOME/.config/bash/bashrc" ] && . "$HOME/.config/bash/bashrc"' >> $HOME/.bashrc
        # Fall back to default location
        else
            SHELL_RC="$HOME/.bashrc"
        fi
    fi
    
    echo_step "Detected shell: $SHELL_TYPE (config: $SHELL_RC)"
    
    # Ask user if they want to use a different config location
    echo "Current shell config location: $SHELL_RC"
    read -p "Use a different config location? (y/N): " change_rc
    if [[ "$change_rc" =~ ^[Yy]$ ]]; then
        read -p "Enter new config path: " new_rc
        if [ -n "$new_rc" ]; then
            # Create directory if it doesn't exist
            mkdir -p "$(dirname "$new_rc")"
            SHELL_RC="$new_rc"
            echo_step "Using custom config: $SHELL_RC"
        fi
    fi
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

# Map package names across distributions
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

###################
# SETUP FUNCTIONS
###################

update_system() {
    echo_header "Updating system packages"
    $PKG_UPDATE
}

install_git() {
    echo_header "Installing Git"
    install_package "git"
}

install_core_packages() {
    echo_header "Installing core packages"
    install_package "fzf"
    install_package "fd-find"
    install_package "npm"
    install_package "ripgrep"
    install_package "wget"
    install_package "curl"
    install_package "make"
}

install_neovim() {
    echo_header "Installing Neovim"
    if [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "neovim"
    elif [ "$PKG_MANAGER" = "apt" ]; then
        sudo add-apt-repository -y ppa:neovim-ppa/unstable
        sudo apt update
        install_package "neovim"
    else
        install_package "neovim"
    fi
}

install_terminal_tools() {
    echo_header "Installing terminal improvements"
    
    # Install Kitty terminal
    echo_step "Installing Kitty terminal"
    if [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "kitty"
    elif [ "$PKG_MANAGER" = "apt" ]; then
        curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin
        # Create symbolic links to add kitty to PATH
        mkdir -p ~/.local/bin
        ln -sf ~/.local/kitty.app/bin/kitty ~/.local/bin/
        ln -sf ~/.local/kitty.app/bin/kitten ~/.local/bin/
    else
        install_package "kitty"
    fi
    
    # Install Starship prompt
    echo_step "Installing Starship prompt"
    curl -sS https://starship.rs/install.sh | sh
    
    # Configure Starship for the detected shell
    if [ "$SHELL_TYPE" = "zsh" ]; then
        echo 'eval "$(starship init zsh)"' >> $SHELL_RC
    else
        echo 'eval "$(starship init bash)"' >> $SHELL_RC
    fi
    
    # Set Starship config location
    mkdir -p ~/.config/starship
    echo 'export STARSHIP_CONFIG=~/.config/starship/starship.toml' >> $SHELL_RC
}

setup_tmux() {
    echo_header "Setting up tmux"
    
    # Run the tmux setup script
    bash ~/dotfiles/tmux/setup_tmux.sh 
    
    # Download tmux plugin manager
    mkdir -p ~/.config/tmux/tpm_plugin
    git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/tpm_plugin/tpm
    
    # Source config if tmux is running
    if command -v tmux &> /dev/null; then
        tmux source ~/.config/tmux/tmux.conf || true
    fi
}

setup_python() {
    echo_header "Setting up Python environment"
    
    # Install pyenv dependencies
    echo_step "Installing pyenv dependencies"
    install_package "build-essential"
    install_package "libssl-dev"
    install_package "zlib1g-dev"
    install_package "libbz2-dev"
    install_package "libreadline-dev"
    install_package "libsqlite3-dev"
    install_package "llvm"
    install_package "libncursesw5-dev"
    install_package "xz-utils"
    install_package "tk-dev"
    install_package "libxml2-dev"
    install_package "libxmlsec1-dev"
    install_package "libffi-dev"
    install_package "liblzma-dev"
    
    # Install pyenv
    echo_step "Installing pyenv"
    mkdir -p ~/workflow-packages/
    git clone https://github.com/pyenv/pyenv.git ~/workflow-packages/.pyenv
    
    # Configure shell for pyenv
    echo_step "Configuring pyenv in $SHELL_RC"
    echo -e 'export PYENV_ROOT="$HOME/workflow-packages/.pyenv"\nexport PATH="$PYENV_ROOT/bin:$PATH"' >> $SHELL_RC
    echo -e 'eval "$(pyenv init --path)"\neval "$(pyenv init -)"' >> $SHELL_RC
    
    # Install poetry
    echo_step "Installing Poetry"
    curl -sSL https://install.python-poetry.org | python3 -
    echo -e 'export PATH="$HOME/.local/bin:$PATH"' >> $SHELL_RC
    
    # Configure poetry
    echo_step "Configuring Poetry"
    poetry config virtualenvs.in-project true
    poetry config virtualenvs.prefer-active-python true
}

install_lazygit() {
    echo_header "Installing LazyGit"
    
    # Get the latest version
    LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*')
    
    # Create temp dir
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"
    
    # Download and extract
    echo_step "Downloading LazyGit version $LAZYGIT_VERSION..."
    curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz"
    tar xf lazygit.tar.gz lazygit
    
    # Install
    echo_step "Installing to /usr/local/bin/lazygit..."
    sudo install -m755 lazygit /usr/local/bin/
    
    # Clean up
    echo_step "Cleaning up..."
    cd - > /dev/null
    rm -rf "$TMP_DIR"
}

configure_system() {
    echo_header "Configuring system"
    
    # Swap caps to escape
    echo_step "Configuring keyboard (caps:swapescape)"
    if [ -f "/etc/default/keyboard" ]; then
        sudo sed -i 's/XKBOPTIONS=".*"/XKBOPTIONS="caps:swapescape"/' /etc/default/keyboard
    else
        sudo bash -c 'echo "XKBOPTIONS=\"caps:swapescape\"" >> /etc/default/keyboard'
    fi
    
    # Change repeat rate
    echo_step "Setting keyboard repeat rate"
    if command -v xset &> /dev/null; then
        xset r rate 300 25
        xset q | grep 'repeat delay'
        
        # Add to shell rc to persist
        echo 'xset r rate 300 25' >> $SHELL_RC
    fi
    
    # Link fd command if using fd-find package
    echo_step "Setting up fd command"
    if command -v fdfind &> /dev/null && ! command -v fd &> /dev/null; then
        sudo ln -s -f "$(which fdfind)" /usr/local/bin/fd
    fi
    
    # Set up tmux-sessionizer
    echo_step "Setting up tmux-sessionizer"
    mkdir -p ~/.local/scripts
    ln -s ~/dotfiles/tmux-sessionizer ~/.local/scripts/tmux-sessionizer
    echo "export PATH=\"\$PATH:\$HOME/.local/scripts\"" >> $SHELL_RC
    chmod +x ~/.local/scripts/tmux-sessionizer
    
    # Install fonts
    echo_step "Installing JetBrains Mono and Nerd Fonts"
    if [ "$PKG_MANAGER" = "apt" ]; then
        install_package "fonts-jetbrains-mono"
    elif [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "ttf-jetbrains-mono"
    fi
    
    mkdir -p ~/.local/share/fonts
    wget https://github.com/ryanoasis/nerd-fonts/releases/download/v3.2.1/JetBrainsMono.zip
    unzip JetBrainsMono.zip -d ~/.local/share/fonts
    rm JetBrainsMono.zip
    
    # Refresh font cache
    if command -v fc-cache &> /dev/null; then
        fc-cache -f -v
    fi
}

###################
# MAIN EXECUTION
###################

main() {
    echo_header "🚀 Starting system setup"
    
    detect_shell
    detect_package_manager
    update_system
    install_git
    install_core_packages
    install_neovim
    setup_tmux
    setup_python
    install_lazygit
    configure_system
    
    echo_header "✅ Setup complete!"
    echo_step "Please restart your terminal or run: source $SHELL_RC"
}

main
