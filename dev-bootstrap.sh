#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/bootstrap-utils.sh"

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dotfiles}"
BOOTSTRAP_NON_INTERACTIVE="${BOOTSTRAP_NON_INTERACTIVE:-false}"

usage() {
    cat <<'EOF'
Usage: dev-bootstrap.sh [options]

Options:
  --yes, --non-interactive  Run without interactive prompts
  -h, --help                Show this help message
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes|--non-interactive)
                BOOTSTRAP_NON_INTERACTIVE=true
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

    export BOOTSTRAP_NON_INTERACTIVE
}

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


version_ge() {
    [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

neovim_version() {
    command -v nvim >/dev/null 2>&1 || return 1
    nvim --version | head -n1 | awk '{print $2}' | sed 's/^v//'
}

install_neovim_release_binary() {
    local required_version="0.12.0"
    local install_root="$HOME/.local/opt"
    local target="$install_root/nvim-v$required_version"
    local tmp_dir

    if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
        echo_warning "Automatic Neovim binary install only supports Linux x86_64; please install Neovim >= $required_version manually"
        return 0
    fi

    mkdir -p "$install_root" "$HOME/.local/bin"

    if [ ! -x "$target/bin/nvim" ]; then
        tmp_dir="$(mktemp -d)"
        curl -L --fail "https://github.com/neovim/neovim/releases/download/v$required_version/nvim-linux-x86_64.tar.gz" -o "$tmp_dir/nvim.tar.gz"
        tar -xzf "$tmp_dir/nvim.tar.gz" -C "$tmp_dir"
        rm -rf "$target"
        mv "$tmp_dir/nvim-linux-x86_64" "$target"
        rm -rf "$tmp_dir"
    fi

    ln -sf "$target/bin/nvim" "$HOME/.local/bin/nvim"
    echo_step "Linked Neovim v$required_version to ~/.local/bin/nvim"
}

install_neovim() {
    echo_header "Installing Neovim"
    local required_version="0.12.0"
    local current_version="$(neovim_version || true)"

    if [ -n "$current_version" ] && version_ge "$current_version" "$required_version"; then
        echo_step "Neovim $current_version already satisfies >= $required_version"
        return 0
    fi

    # Add PPA for latest version on Ubuntu/Debian
    if [ "$PKG_MANAGER" = "apt" ]; then
        if ! grep -q "neovim-ppa/unstable" /etc/apt/sources.list.d/*.list 2>/dev/null; then
            sudo add-apt-repository -y ppa:neovim-ppa/unstable
            sudo apt update
        fi
    fi

    install_package "neovim"
    current_version="$(neovim_version || true)"
    if [ -z "$current_version" ] || ! version_ge "$current_version" "$required_version"; then
        install_neovim_release_binary
    fi
}

setup_tree_sitter_cli() {
    echo_header "Installing tree-sitter CLI"

    if command -v tree-sitter >/dev/null 2>&1; then
        echo_step "tree-sitter already installed: $(tree-sitter --version)"
        return 0
    fi

    if [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "tree-sitter-cli" || true
    fi

    if command -v tree-sitter >/dev/null 2>&1; then
        return 0
    fi

    if command -v cargo >/dev/null 2>&1; then
        cargo install tree-sitter-cli --version 0.26.10 --locked
        mkdir -p "$HOME/.local/bin"
        ln -sf "$HOME/.cargo/bin/tree-sitter" "$HOME/.local/bin/tree-sitter"
        echo_step "Linked tree-sitter CLI to ~/.local/bin/tree-sitter"
    else
        echo_warning "tree-sitter CLI is required by nvim-treesitter on Neovim 0.12; install tree-sitter-cli manually"
    fi
}

install_ghostty() {
    echo_header "Installing Ghostty terminal"

    if [ "$PKG_MANAGER" = "pacman" ]; then
        install_package "ghostty"
    else
        echo_warning "Ghostty install is not automated for $PKG_MANAGER; install it manually if needed"
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
    command -v tree-sitter &>/dev/null && echo "  ✓ tree-sitter $(tree-sitter --version)"
    command -v tmux &>/dev/null && echo "  ✓ Tmux $(tmux -V)"
    command -v starship &>/dev/null && echo "  ✓ Starship $(starship --version)"
    command -v zoxide &>/dev/null && echo "  ✓ Zoxide $(zoxide --version)"
    command -v lazygit &>/dev/null && echo "  ✓ LazyGit $(lazygit --version)"
    command -v ghostty &>/dev/null && echo "  ✓ Ghostty $(ghostty --version | head -n1)"
    command -v uv &>/dev/null && echo "  ✓ uv $(uv --version)"
    echo ""
}

###################
# MAIN EXECUTION
###################

main() {
    echo_header "🚀 Starting system setup"

    parse_args "$@"
    
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
    setup_tree_sitter_cli
    install_ghostty
    install_starship
    install_zoxide
    setup_tmux
    setup_python
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
    echo "  2. Open nvim once; vim.pack and Mason will handle plugin/tool setup"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
