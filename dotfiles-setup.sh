#!/usr/bin/env bash

set -euo pipefail

DOTFILES_REPO="https://github.com/alphiree/dotfiles.git"
DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dotfiles}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config}"
INTERACTIVE=true
CONFLICT_STRATEGY="backup"
MODULES_ARG=""

DEFAULT_MODULES=(
    kitty
    lazygit
    nvim
    opencode
    pi
    starship
    tmux
    zsh
)

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
    cat <<'EOF'
Usage: dotfiles-setup.sh [options]

Options:
  --yes, --non-interactive   Run without prompts
  --modules LIST             Comma-separated modules to link (example: zsh,nvim,tmux)
  --overwrite                Overwrite existing targets when conflicts happen
  --skip-existing            Skip existing targets when conflicts happen
  --backup-existing          Backup existing targets when conflicts happen (default)
  -h, --help                 Show this help message
EOF
}

print_header() {
    echo -e "${BLUE}==>${NC} ${BOLD}$1${NC}"
}

print_step() {
    echo -e "${GREEN}-->${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --yes|--non-interactive)
                INTERACTIVE=false
                ;;
            --modules)
                MODULES_ARG="${2:-}"
                shift
                ;;
            --overwrite)
                CONFLICT_STRATEGY="overwrite"
                ;;
            --skip-existing)
                CONFLICT_STRATEGY="skip"
                ;;
            --backup-existing)
                CONFLICT_STRATEGY="backup"
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
        shift
    done
}

handle_existing_target() {
    local target="$1"

    if [ "$INTERACTIVE" = true ]; then
        read -r -p "Target exists ($target). (b)ackup, (o)verwrite, (s)kip: " action
        case "$action" in
            b|B) CONFLICT_STRATEGY="backup" ;;
            o|O) CONFLICT_STRATEGY="overwrite" ;;
            *) CONFLICT_STRATEGY="skip" ;;
        esac
    fi

    case "$CONFLICT_STRATEGY" in
        backup)
            local backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
            print_step "Backing up $target to $backup"
            mv "$target" "$backup"
            ;;
        overwrite)
            print_step "Overwriting $target"
            rm -rf "$target"
            ;;
        skip)
            print_step "Skipping $target"
            return 1
            ;;
        *)
            print_error "Invalid conflict strategy: $CONFLICT_STRATEGY"
            return 1
            ;;
    esac

    return 0
}

create_symlink() {
    local source="$1"
    local target="$2"

    if [ -e "$target" ] || [ -L "$target" ]; then
        if [ -L "$target" ]; then
            local current_link
            current_link="$(readlink "$target" || true)"
            if [ "$current_link" = "$source" ]; then
                print_step "Link already exists: $target -> $source"
                return 0
            fi
            print_warning "Different symlink exists: $target -> $current_link"
        else
            print_warning "Target already exists and is not a symlink: $target"
        fi

        if ! handle_existing_target "$target"; then
            return 0
        fi
    fi

    mkdir -p "$(dirname "$target")"
    ln -s "$source" "$target"
    print_step "Created symlink: $target -> $source"
}

update_or_clone_repo() {
    if [ -d "$DOTFILES_DIR/.git" ]; then
        print_warning "Dotfiles directory already exists at $DOTFILES_DIR"
        local should_update=false

        if [ "$INTERACTIVE" = true ]; then
            read -r -p "Update existing dotfiles? (y/N): " update_existing
            [[ "$update_existing" =~ ^[Yy]$ ]] && should_update=true
        else
            should_update=true
        fi

        if [ "$should_update" = true ]; then
            print_step "Updating dotfiles repository..."
            if ! git -C "$DOTFILES_DIR" pull --ff-only; then
                print_warning "Could not fast-forward dotfiles repo, continuing with current checkout"
            fi
        else
            print_step "Using existing dotfiles without updating"
        fi
    elif [ -d "$DOTFILES_DIR" ]; then
        print_warning "Directory exists but is not a git repository: $DOTFILES_DIR"
        print_step "Using existing directory contents"
    else
        print_step "Cloning dotfiles repository..."
        git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
    fi
}

resolve_modules() {
    MODULES_TO_LINK=()

    if [ -n "$MODULES_ARG" ]; then
        local parsed
        parsed="${MODULES_ARG//,/ }"
        for module in $parsed; do
            MODULES_TO_LINK+=("$module")
        done
    elif [ "$INTERACTIVE" = false ]; then
        MODULES_TO_LINK=("${DEFAULT_MODULES[@]}")
    else
        print_header "Available dotfile modules:"
        for module in "${DEFAULT_MODULES[@]}"; do
            echo "  - $module"
        done

        read -r -p "Link all modules? (Y/n): " link_all
        if [[ ! "$link_all" =~ ^[Nn]$ ]]; then
            MODULES_TO_LINK=("${DEFAULT_MODULES[@]}")
        else
            for module in "${DEFAULT_MODULES[@]}"; do
                read -r -p "Link $module? (y/N): " link_module
                if [[ "$link_module" =~ ^[Yy]$ ]]; then
                    MODULES_TO_LINK+=("$module")
                fi
            done
        fi
    fi
}

link_pi_module() {
    local pi_agent_dir="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
    local pi_source_dir="$DOTFILES_DIR/pi/agent"
    local pi_items=(settings.json local-llms.json extensions themes)

    if [ ! -d "$pi_source_dir" ]; then
        print_warning "Pi config module not found, skipping: pi"
        return 0
    fi

    mkdir -p "$pi_agent_dir"

    for item in "${pi_items[@]}"; do
        if [ ! -e "$pi_source_dir/$item" ]; then
            print_warning "Pi config item not found, skipping: $item"
            continue
        fi

        create_symlink "$pi_source_dir/$item" "$pi_agent_dir/$item"
    done
}

link_modules() {
    print_header "Creating symlinks for dotfiles"

    for module in "${MODULES_TO_LINK[@]}"; do
        if [ "$module" = "pi" ]; then
            link_pi_module
            continue
        fi

        local module_dir="$DOTFILES_DIR/$module"
        local target_dir="$CONFIG_DIR/$module"

        if [ ! -d "$module_dir" ]; then
            print_warning "Module not found, skipping: $module"
            continue
        fi

        create_symlink "$module_dir" "$target_dir"
    done
}

main() {
    parse_args "$@"
    update_or_clone_repo
    mkdir -p "$CONFIG_DIR"
    resolve_modules
    link_modules

    print_header "Dotfiles setup complete"
    print_step "Linked modules: ${MODULES_TO_LINK[*]}"
}

main "$@"
