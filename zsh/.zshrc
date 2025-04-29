#!/bin/sh
HISTSIZE=10000
SAVEHIST=100000
HISTFILE=~/.zsh_history

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



eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship/starship.toml
export PYENV_ROOT="$HOME/workflow-packages/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"
if [ -n "$DISPLAY" ]; then xset r rate 300 25; fi
export PATH="$PATH:$HOME/.local/scripts"
