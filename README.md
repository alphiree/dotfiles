## Dotfiles

A collection of configuration files and setup scripts for a consistent development environment across different machines.

## Overview

This repository contains personal dotfiles and setup scripts for quickly configuring a development environment. It includes configurations for shells (bash/zsh), editors, terminal utilities, and development tools.

This dotfiles contain the following:

- `kitty` - I currently use kitty as my terminal emulator.
- `lazygit`
- `nvim`
- `starship`
- `tmux`
- `zsh`

## Quick Setup

1. Run the `dotfiles-setup.sh` script (This script will just clone this whole repo and link it to your home directory `.config` folder)

```
curl -o dotfiles-setup.sh https://raw.githubusercontent.com/alphiree/dotfiles/main/dotfiles-setup.sh
chmod +x dotfiles-setup.sh
./dotfiles-setup.sh
```

2. (OPTIONAL: If you want to use `zsh` as your shell instead of `bash`) Run the `setup-zsh.sh` script (This script will install zsh and configure it with the included settings, and set it as your default shell)

```
chmod +x ~/.config/zsh/setup-zsh.sh
~/.config/zsh/setup-zsh.sh
```

After doing this, log out and log back in (if this doesn't work try rebooting) to apply the changes.

3. Run the bootstrap script to install all the packages and tools

```
chmod +x ~/.config/dev-bootstrap.sh
~/.config/dev-bootstrap.sh
```
