#!/bin/sh
export ZDOTDIR=$HOME/.config/zsh
setopt appendhistory

# Basic options
setopt autocd extendedglob nomatch 
setopt interactive_comments

# Basic completion
autoload -Uz compinit
compinit
_comp_options+=(globdots)		# Include hidden files.

# Colors
autoload -Uz colors && colors

# Useful Functions (needed for plugins)
source "$ZDOTDIR/zsh-functions"

# Plugins
zsh_add_plugin "zsh-users/zsh-autosuggestions"
zsh_add_plugin "zsh-users/zsh-syntax-highlighting"
zsh_add_plugin "hlissner/zsh-autopair"

# Simple default-like prompt (uncomment if needed)
# PS1='%n@%m %~ %# '



