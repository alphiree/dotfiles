#!/usr/bin/env bash

set -e

DOTFILES_REPO="https://github.com/alphiree/dotfiles.git"
DOTFILES_DIR="$HOME/dotfiles"
CONFIG_DIR="$HOME/.config"

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if dotfiles already exist
if [ -d "$DOTFILES_DIR" ]; then
    print_warning "Dotfiles directory already exists at $DOTFILES_DIR"
    read -p "Update existing dotfiles? (y/N): " update_existing
    if [[ "$update_existing" =~ ^[Yy]$ ]]; then
        print_step "Updating dotfiles repository..."
        cd "$DOTFILES_DIR"
        git pull
    else
        print_step "Using existing dotfiles without updating"
    fi
else
    print_step "Cloning dotfiles repository..."
    git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
fi

# Create ~/.config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Function to create symbolic links
create_symlink() {
    local source="$1"
    local target="$2"
    
    # Check if target already exists
    if [ -e "$target" ]; then
        if [ -L "$target" ]; then
            # It's already a symlink
            local current_link=$(readlink -f "$target")
            if [ "$current_link" = "$source" ]; then
                print_step "Link already exists: $target -> $source"
                return 0
            else
                print_warning "Different symlink exists: $target -> $current_link"
            fi
        else
            # It's a regular file or directory
            print_warning "Target already exists and is not a symlink: $target"
        fi
        
        # Ask what to do with existing target
        read -p "What would you like to do? (b)ackup, (o)verwrite, (s)kip: " action
        case "$action" in
            b|B)
                local backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
                print_step "Backing up to $backup"
                mv "$target" "$backup"
                ;;
            o|O)
                print_step "Overwriting $target"
                rm -rf "$target"
                ;;
            *)
                print_step "Skipping $target"
                return 0
                ;;
        esac
    fi
    
    # Create parent directory if needed
    mkdir -p "$(dirname "$target")"
    
    # Create the symlink
    ln -s "$source" "$target"
    print_step "Created symlink: $target -> $source"
}

# Available dotfile modules
AVAILABLE_MODULES=$(find "$DOTFILES_DIR" -maxdepth 1 -type d ! -path "$DOTFILES_DIR" -exec basename {} \; | sort)
MODULES_TO_LINK=()

print_header "Available dotfile modules:"
for module in $AVAILABLE_MODULES; do
    echo "  - $module"
done

read -p "Link all modules? (Y/n): " link_all
if [[ ! "$link_all" =~ ^[Nn]$ ]]; then
    MODULES_TO_LINK=($AVAILABLE_MODULES)
else
    for module in $AVAILABLE_MODULES; do
        read -p "Link $module? (y/N): " link_module
        if [[ "$link_module" =~ ^[Yy]$ ]]; then
            MODULES_TO_LINK+=("$module")
        fi
    done
fi

# Create symlinks for selected modules
print_header "Creating symlinks for dotfiles..."
for module in "${MODULES_TO_LINK[@]}"; do
    module_dir="$DOTFILES_DIR/$module"
    
    # Check if special handling is needed for this module
    case "$module" in
        # Default behavior - link to ~/.config/module
        *)
            create_symlink "$module_dir" "$CONFIG_DIR/$module"
            ;;
    esac
done

print_header "Dotfiles setup complete!"
