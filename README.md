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
curl -s https://raw.githubusercontent.com/alphiree/dotfiles/main/dotfiles-setup.sh | bash
```

2. (OPTIONAL: If you want to use `zsh` as your shell instead of `bash`) Run the `setup-zsh.sh` script (This script will install zsh and configure it with the included settings, and set it as your default shell)

```
./.config/zsh/setup-zsh.sh
```

After doing this, log out and log back in to apply the changes.

3. Run the bootstrap script to install all the packages and tools

```
./config/dev-bootstrap.sh
```
