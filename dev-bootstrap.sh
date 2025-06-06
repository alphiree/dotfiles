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

# Improved shell detection function
detect_shell() {
    # First check if we're running in zsh
    if [ -n "$ZSH_VERSION" ]; then
        SHELL_TYPE="zsh"
    # Then check if zsh is installed and the default shell
    elif [ -n "$SHELL" ] && [[ "$SHELL" == *"zsh"* ]]; then
        SHELL_TYPE="zsh"
    # Also check if zsh is in /etc/passwd as the user's shell
    elif grep -q "$(whoami).*zsh" /etc/passwd 2>/dev/null; then
        SHELL_TYPE="zsh"
    # Also check if zsh is installed
    elif command -v zsh >/dev/null 2>&1; then
        echo_step "Found zsh installed but not running in zsh session"
        read -p "Would you like to use zsh configuration? (Y/n): " use_zsh
        if [[ "$use_zsh" =~ ^[Nn]$ ]]; then
            SHELL_TYPE="bash"
        else
            SHELL_TYPE="zsh"
        fi
    # Fallback to bash
    else
        SHELL_TYPE="bash"
    fi
    
    # Now determine the appropriate config file based on shell type
    if [ "$SHELL_TYPE" = "zsh" ]; then
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
        # Check if XDG config exists for bash
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
    install_package "unzip"
    install_package "go"
    install_package "fuse"
    install_package "ntfs-3g" # for mounting
    ## to be able to copy and paste inside nvim
    if [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "wl-clipboard"
    elif [ "$PKG_MANAGER" = "apt" ]; then
        install_package "xclip"
    fi
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

    if command -v magick &> /dev/null; then
        echo_step "magick already installed, skipping"
    else
        echo_header "Installing Luarocks, Lua51, and magick to support image preview inside nvim"
        install_package "luarocks"
        install_package "lua51"
        luarocks install magick --lua-version=5.1
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
    
    if command -v starship &> /dev/null; then
        echo_step "Starship already installed, skipping"
    else
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
    fi

    if command -v zoxide &> /dev/null; then
        echo_step "zoxide already installed, skipping"
    else
        echo_step "installing zoxide"
        ## Install via script
        curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh
        # Configure Starship for the detected shell
        echo -e 'export PATH="$HOME/.local/bin:$PATH"' >> $SHELL_RC
        if [ "$SHELL_TYPE" = "zsh" ]; then
            echo 'eval "$(zoxide init zsh)"' >> $SHELL_RC
        else
            echo 'eval "$(zoxide init bash)"' >> $SHELL_RC
        fi
    fi
}

setup_tmux() {
    echo_header "Setting up tmux"
    
    # Run the tmux setup script
    ## bash ~/dotfiles/tmux/setup_tmux.sh 
    install_package "tmux"

    # Download tmux plugin manager
    echo_header "Downloading tmux plugin manager"
    if [ ! -d ~/.config/tmux/tpm_plugin/tpm ]; then
        mkdir -p ~/.config/tmux/tpm_plugin
        git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/tpm_plugin/tpm
    else
        echo_step "tmux plugin manager already installed, skipping"
    fi
    
    # Source config if tmux is running
    if command -v tmux &> /dev/null; then
        tmux source ~/.config/tmux/tmux.conf || true
    fi
}

setup_python() {
    echo_header "Setting up Python environment"

    # Install Python3
    install_package "python3"

    # Install pyenv
    echo_step "Installing pyenv"
    mkdir -p ~/workflow-packages/
    if [ ! -d ~/workflow-packages/.pyenv ]; then
        git clone https://github.com/pyenv/pyenv.git ~/workflow-packages/.pyenv
        # Configure shell for pyenv
        echo_step "Configuring pyenv in $SHELL_RC"
        echo -e 'export PYENV_ROOT="$HOME/workflow-packages/.pyenv"\nexport PATH="$PYENV_ROOT/bin:$PATH"' >> $SHELL_RC
        echo -e 'eval "$(pyenv init --path)"\neval "$(pyenv init -)"' >> $SHELL_RC
    else
        echo_step "pyenv already installed, skipping"
    fi
    
    # Install pyenv-virtualenv
    echo_step "Installing pyenv-virtualenv"
    if [ ! -d ~/workflow-packages/.pyenv/plugins/pyenv-virtualenv ]; then
        git clone https://github.com/pyenv/pyenv-virtualenv.git ~/workflow-packages/.pyenv/plugins/pyenv-virtualenv
        # Configure shell for pyenv-virtualenv
        echo_step "Configuring pyenv-virtualenv in $SHELL_RC"
        echo -e 'eval "$(pyenv virtualenv-init -)"' >> $SHELL_RC
    else
        echo_step "pyenv-virtualenv already installed, skipping"
    fi
    
    # Install poetry
    if command -v poetry &> /dev/null; then
        echo_step "poetry already installed, skipping"
    else
        echo_step "Installing Poetry"
        curl -sSL https://install.python-poetry.org | python3 -
        if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_RC"; then
            # Add the command to rc file if it's not already present
            echo -e 'export PATH="$HOME/.local/bin:$PATH"' >> $SHELL_RC
        fi
        poetry config virtualenvs.in-project true
    fi
     
}

install_lazygit() {
    echo_header "Installing LazyGit"
    
    # Check if lazygit is already installed
    if command -v lazygit &> /dev/null; then
        echo_step "LazyGit is already installed, skipping..."
        return
    fi
    
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
    
    # Debian/Ubuntu/Mint approach
    if [ -f "/etc/default/keyboard" ]; then
        echo_step "Using Debian/Ubuntu/Mint method"
        sudo sed -i 's/XKBOPTIONS=".*"/XKBOPTIONS="caps:swapescape"/' /etc/default/keyboard
        sudo dpkg-reconfigure -f noninteractive keyboard-configuration 2>/dev/null || true
    # Arch Linux approach
    elif [ -f "/etc/X11/xorg.conf.d/00-keyboard.conf" ] || command -v localectl >/dev/null 2>&1; then
        echo_step "Using Arch Linux method"
        # Create keyboard config if it doesn't exist
        if [ ! -f "/etc/X11/xorg.conf.d/00-keyboard.conf" ]; then
            sudo mkdir -p /etc/X11/xorg.conf.d
            sudo touch /etc/X11/xorg.conf.d/00-keyboard.conf
        fi
        
        # Configure using localectl if available
        if command -v localectl >/dev/null 2>&1; then
            sudo localectl set-x11-keymap us "" "" caps:swapescape
        else
            # Direct configuration
            sudo bash -c 'cat > /etc/X11/xorg.conf.d/00-keyboard.conf << EOF
                Section "InputClass"
                        Identifier "system-keyboard"
                        MatchIsKeyboard "on"
                        Option "XkbOptions" "caps:swapescape"
                EndSection
                EOF'
        fi
    # Fallback for other distros - use xmodmap
    else
        echo_step "Using fallback method with xmodmap"
        echo 'clear lock' > ~/.Xmodmap
        echo 'keycode 9 = Caps_Lock NoSymbol Caps_Lock' >> ~/.Xmodmap
        echo 'keycode 66 = Escape NoSymbol Escape' >> ~/.Xmodmap
        
        # Add to shell rc to persist
        echo 'if [ -f ~/.Xmodmap ] && [ -n "$DISPLAY" ]; then xmodmap ~/.Xmodmap; fi' >> $SHELL_RC
        
        # Apply immediately if display is available
        if [ -n "$DISPLAY" ]; then
            xmodmap ~/.Xmodmap 2>/dev/null || true
        fi
    fi

    # Change repeat rate
    echo_step "Setting keyboard repeat rate"
    if command -v xset &> /dev/null && [ -n "$DISPLAY" ]; then
        xset r rate 300 25
        xset q | grep 'repeat delay'
        
        # Check if the command is already in the shell rc file
        if ! grep -q 'xset r rate 300 25' "$SHELL_RC"; then
            # Add the command to rc file if it's not already present
            echo 'if [ -n "$DISPLAY" ]; then xset r rate 300 25; fi' >> "$SHELL_RC"
        fi
    else
        echo_step "Skipping xset commands - no display available"
        # Check if the command is already in the shell rc file, even when no display is available
        if ! grep -q 'xset r rate 300 25' "$SHELL_RC"; then
            echo 'if [ -n "$DISPLAY" ]; then xset r rate 300 25; fi' >> "$SHELL_RC"
        fi
    fi
    
    # Link fd command if using fd-find package
    echo_step "Setting up fd command"
    if command -v fdfind &> /dev/null && ! command -v fd &> /dev/null; then
        sudo ln -s -f "$(which fdfind)" /usr/local/bin/fd
    fi
    
    # Set up tmux-sessionizer
    echo_step "Setting up tmux-sessionizer"
    if [ ! -e ~/.local/scripts/tmux-sessionizer ]; then
        mkdir -p ~/.local/scripts
        ln -s ~/dotfiles/tmux-sessionizer ~/.local/scripts/tmux-sessionizer
        echo "export PATH=\"\$PATH:\$HOME/.local/scripts\"" >> $SHELL_RC
        chmod +x ~/.local/scripts/tmux-sessionizer
    else
        echo_step "tmux-sessionizer already exists, skipping symlink creation"
    fi
    
    # Install fonts
    echo_step "Installing JetBrains Mono and Nerd Fonts"
    if [ "$PKG_MANAGER" = "apt" ]; then
        install_package "fonts-jetbrains-mono"
    elif [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "ttf-jetbrains-mono"
    fi
    
    mkdir -p ~/.local/share/fonts
    # Check if the zip file already exists
    if [ -f "JetBrainsMono.zip" ]; then
        echo_step "JetBrainsMono.zip already exists, using existing file"
        # Check if fonts are already installed
        if ls ~/.local/share/fonts/JetBrainsMono*.ttf > /dev/null 2>&1 || ls ~/.local/share/fonts/JetBrainsMonoNerdFont*.ttf > /dev/null 2>&1; then
            echo_step "JetBrains Mono Nerd Fonts already installed, skipping unzip"
        else
            echo_step "Unzipping JetBrains Mono Nerd Fonts"
            unzip JetBrainsMono.zip -d ~/.local/share/fonts
        fi
        # Delete the zip file regardless
        rm JetBrainsMono.zip
        # Refresh font cache
        if command -v fc-cache &> /dev/null; then
            fc-cache -f -v
        fi
    else
        # Check if fonts are already installed
        if ls ~/.local/share/fonts/JetBrainsMono*.ttf > /dev/null 2>&1 || ls ~/.local/share/fonts/JetBrainsMonoNerdFont*.ttf > /dev/null 2>&1; then
            echo_step "JetBrains Mono Nerd Fonts already installed, skipping download"
        else
            echo_step "Downloading JetBrains Mono Nerd Fonts"
            wget https://github.com/ryanoasis/nerd-fonts/releases/download/v3.2.1/JetBrainsMono.zip
            echo_step "Unzipping JetBrains Mono Nerd Fonts"
            unzip JetBrainsMono.zip -d ~/.local/share/fonts
            rm JetBrainsMono.zip
            # Refresh font cache
            if command -v fc-cache &> /dev/null; then
                fc-cache -f -v
            fi
        fi
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
    install_terminal_tools
    setup_tmux
    setup_python
    install_lazygit
    configure_system
    
    echo_header "✅ Setup complete!"
    echo_step "Please restart your terminal or run: source $SHELL_RC"
}

main
