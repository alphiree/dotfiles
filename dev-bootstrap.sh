#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/bootstrap-utils.sh"

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dotfiles}"

CORE_PACKAGES=(
    git
    fzf
    fd-find
    npm
    ripgrep
    wget
    curl
    make
    unzip
    go
    fuse
    ntfs-3g
    tmux
    python3
    neovim
    clipboard
)


install_neovim() {
    echo_header "Installing Neovim"
    
    # Add PPA for latest version on Ubuntu/Debian
    if [ "$PKG_MANAGER" = "apt" ]; then
        if ! grep -q "neovim-ppa/unstable" /etc/apt/sources.list.d/*.list 2>/dev/null; then
            sudo add-apt-repository -y ppa:neovim-ppa/unstable
            sudo apt update
        fi
    fi
    
    install_package "neovim"
}

install_kitty() {
    echo_header "Installing Kitty terminal"
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        install_if_missing \
            "Kitty" \
            "command -v kitty" \
            "curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin && \
             mkdir -p ~/.local/bin && \
             ln -sf ~/.local/kitty.app/bin/kitty ~/.local/bin/ && \
             ln -sf ~/.local/kitty.app/bin/kitten ~/.local/bin/"
    else
        install_package "kitty"
    fi
}

install_starship() {
    echo_header "Installing Starship prompt"
    
    install_if_missing \
        "Starship" \
        "command -v starship" \
        "curl -sS https://starship.rs/install.sh | sh -s -- -y"
    
    if [ "$SHELL_TYPE" = "zsh" ]; then
        append_if_missing "starship init" 'eval "$(starship init zsh)"' "$SHELL_RC" true
    else
        append_if_missing "starship init" 'eval "$(starship init bash)"' "$SHELL_RC" true
    fi
    
    mkdir -p ~/.config/starship
    append_if_missing 'export STARSHIP_CONFIG=~/.config/starship/starship.toml' \
        'export STARSHIP_CONFIG=~/.config/starship/starship.toml' "$SHELL_RC"
}

install_zoxide() {
    echo_header "Installing zoxide"
    
    install_if_missing \
        "zoxide" \
        "command -v zoxide" \
        "curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh"
    
    append_if_missing 'export PATH="$HOME/.local/bin:$PATH"' \
        'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_RC"
    
    if [ "$SHELL_TYPE" = "zsh" ]; then
        append_if_missing "zoxide init" 'eval "$(zoxide init zsh)"' "$SHELL_RC" true
    else
        append_if_missing "zoxide init" 'eval "$(zoxide init bash)"' "$SHELL_RC" true
    fi
}

setup_tmux() {
    echo_header "Setting up tmux"
    
    # Install TPM (Tmux Plugin Manager)
    install_if_missing \
        "tmux plugin manager" \
        "[ -d ~/.config/tmux/tpm_plugin/tpm ]" \
        "mkdir -p ~/.config/tmux/tpm_plugin && \
         git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/tpm_plugin/tpm"
    
    # Source config if tmux is running
    if command -v tmux &>/dev/null && tmux list-sessions &>/dev/null; then
        tmux source ~/.config/tmux/tmux.conf 2>/dev/null || true
    fi
}

setup_python() {
    echo_header "Setting up Python environment"
    
    # Install uv (fast Python package installer)
    install_if_missing \
        "uv" \
        "command -v uv" \
        "curl -LsSf https://astral.sh/uv/install.sh | sh"
    
    # Add uv to PATH
    append_if_missing 'export PATH="$HOME/.local/bin:$PATH"' \
        'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_RC"
}

setup_docker() {
    echo_header "Setting up Docker"

    if [ "$PKG_MANAGER" = "apt" ]; then
        install_if_missing \
            "docker" \
            "command -v docker" \
            # Need to test this manually yet
    else
        install_package "docker"
        sudo systemctl enable docker # make sure docker is running everytime system starts
        sudo usermod -aG docker $USER
    fi
}

install_lazygit() {
    echo_header "Installing LazyGit"
    
    install_if_missing \
        "LazyGit" \
        "command -v lazygit" \
        "LAZYGIT_VERSION=\$(curl -s 'https://api.github.com/repos/jesseduffield/lazygit/releases/latest' | grep -Po '\"tag_name\": \"v\K[^\"]*') && \
         TMP_DIR=\$(mktemp -d) && \
         cd \$TMP_DIR && \
         curl -Lo lazygit.tar.gz \"https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_\${LAZYGIT_VERSION}_Linux_x86_64.tar.gz\" && \
         tar xf lazygit.tar.gz lazygit && \
         sudo install -m755 lazygit /usr/local/bin/ && \
         cd - >/dev/null && \
         rm -rf \$TMP_DIR"
}

install_fonts() {
    echo_header "Installing JetBrains Mono Nerd Fonts"
    mkdir -p ~/.local/share/fonts
    
    if ls ~/.local/share/fonts/JetBrainsMono*.ttf &>/dev/null || \
       ls ~/.local/share/fonts/JetBrainsMonoNerdFont*.ttf &>/dev/null; then
        echo_step "JetBrains Mono Nerd Fonts already installed, skipping"
        return 0
    fi
    
    case $PKG_MANAGER in
        "apt") install_package "fonts-jetbrains-mono" ;;
        "pacman") install_package "ttf-jetbrains-mono" ;;
    esac
    # Download and install Nerd Font variant
    echo_step "Downloading JetBrains Mono Nerd Fonts"
    local tmp_zip="JetBrainsMono.zip"
    
    if [ -f "$tmp_zip" ]; then
        echo_step "Using existing $tmp_zip"
    else
        wget -q --show-progress https://github.com/ryanoasis/nerd-fonts/releases/download/v3.2.1/JetBrainsMono.zip
    fi
    
    echo_step "Installing fonts"
    unzip -q -o "$tmp_zip" -d ~/.local/share/fonts
    rm -f "$tmp_zip"
    
    # Refresh font cache
    if command -v fc-cache &>/dev/null; then
        fc-cache -fv ~/.local/share/fonts >/dev/null 2>&1
        echo_step "Font cache refreshed"
    fi
}

# SYSTEM CONFIGURATION
configure_keyboard() {
    echo_header "Configuring keyboard"
    echo_step "Setting caps lock to escape"
    
    # Debian/Ubuntu/Mint
    if [ -f "/etc/default/keyboard" ]; then
        sudo sed -i 's/XKBOPTIONS=".*"/XKBOPTIONS="caps:swapescape"/' /etc/default/keyboard
        sudo dpkg-reconfigure -f noninteractive keyboard-configuration 2>/dev/null || true
    
    # Arch Linux
    elif [ -f "/etc/X11/xorg.conf.d/00-keyboard.conf" ] || command -v localectl >/dev/null 2>&1; then
        if command -v localectl >/dev/null 2>&1; then
            sudo localectl set-x11-keymap us "" "" caps:swapescape
        else
            sudo mkdir -p /etc/X11/xorg.conf.d
            sudo bash -c 'cat > /etc/X11/xorg.conf.d/00-keyboard.conf << EOF
                Section "InputClass"
                        Identifier "system-keyboard"
                        MatchIsKeyboard "on"
                        Option "XkbOptions" "caps:swapescape"
                EndSection
                EOF'
        fi
    
    # Fallback with xmodmap
    else
        cat > ~/.Xmodmap <<'EOF'
clear lock
keycode 9 = Caps_Lock NoSymbol Caps_Lock
keycode 66 = Escape NoSymbol Escape
EOF

    append_if_missing "Xmodmap" \
        'if [ -f ~/.Xmodmap ] && [ -n "$DISPLAY" ]; then xmodmap ~/.Xmodmap; fi' \
        "$SHELL_RC" true

    [ -n "$DISPLAY" ] && xmodmap ~/.Xmodmap 2>/dev/null || true
    fi

    # Set keyboard repeat rate
    echo_step "Setting keyboard repeat rate (300ms delay, 25 repeats/sec)"
    
    append_if_missing "xset r rate" \
        'if [ -n "$DISPLAY" ]; then xset r rate 300 25; fi' \
        "$SHELL_RC" true
    
    if [ -n "$DISPLAY" ] && command -v xset &>/dev/null; then
        xset r rate 300 25
        xset q | grep 'repeat delay'
    fi
}

setup_tmux_sessionizer() {
    echo_header "Setting up tmux-sessionizer"
    
    local scripts_dir="$HOME/.local/scripts"
    local tmux_sessionizer="$scripts_dir/tmux-sessionizer"
    local source_script="$DOTFILES_DIR/tmux-sessionizer"
    
    mkdir -p "$scripts_dir"
    
    if [ ! -e "$tmux_sessionizer" ]; then
        if [ -f "$source_script" ]; then
            ln -s "$source_script" "$tmux_sessionizer"
            chmod +x "$tmux_sessionizer"
            echo_step "Linked tmux-sessionizer from dotfiles"
        else
            echo_warning "Source script not found at $source_script"
        fi
    else
        echo_step "tmux-sessionizer already exists"
    fi
    
    append_if_missing 'export PATH="$PATH:$HOME/.local/scripts"' \
        'export PATH="$PATH:$HOME/.local/scripts"' "$SHELL_RC"
}

setup_fd_command() {
    echo_header "Setting up fd command"
    # Link fdfind to fd if needed (Debian/Ubuntu)
    if command -v fdfind &>/dev/null && ! command -v fd &>/dev/null; then
        sudo ln -sf "$(which fdfind)" /usr/local/bin/fd
        echo_step "Linked fdfind to fd"
    fi
}

show_summary() {
    echo_header "📋 Installation Summary"
    echo ""
    echo "Shell: $SHELL_TYPE"
    echo "Config: $SHELL_RC"
    echo "Package Manager: $PKG_MANAGER"
    echo ""
    echo "Installed tools:"
    command -v nvim &>/dev/null && echo "  ✓ Neovim $(nvim --version | head -n1)"
    command -v tmux &>/dev/null && echo "  ✓ Tmux $(tmux -V)"
    command -v starship &>/dev/null && echo "  ✓ Starship $(starship --version)"
    command -v zoxide &>/dev/null && echo "  ✓ Zoxide $(zoxide --version)"
    command -v lazygit &>/dev/null && echo "  ✓ LazyGit $(lazygit --version)"
    command -v kitty &>/dev/null && echo "  ✓ Kitty $(kitty --version)"
    command -v uv &>/dev/null && echo "  ✓ uv $(uv --version)"
    echo ""
}

###################
# MAIN EXECUTION
###################

main() {
    echo_header "🚀 Starting system setup"
    
    detect_shell
    detect_package_manager
    
    # Update system
    echo_header "Updating system packages"
    $PKG_UPDATE
    
    # Install core packages
    echo_header "Installing core packages"
    for pkg in "${CORE_PACKAGES[@]}"; do
        install_package "$pkg"
    done
    
    # Install additional tools
    install_neovim
    install_kitty
    install_starship
    install_zoxide
    setup_tmux
    setup_python
    setup_docker
    install_lazygit
    
    # Configure system
    configure_keyboard
    setup_fd_command
    setup_tmux_sessionizer
    install_fonts
    
    show_summary
    
    echo_header "✅ Setup complete!"
    echo_step "Please restart your terminal or run: source $SHELL_RC"
    echo ""
    echo "Next steps:"
    echo "  1. Open tmux and press prefix + I to install plugins"
    echo "  2. Open nvim and run :Lazy sync to install plugins"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
