#!/bin/sh
## BASIC CONFIG
HISTSIZE=10000
SAVEHIST=100000
HISTFILE=~/.zsh_history
export ZDOTDIR=$HOME/.config/zsh
setopt appendhistory

## Simple default-like prompt (uncomment if needed)
PS1='%n@%m %~ %# '

## Basic options
setopt autocd extendedglob nomatch 
setopt interactive_comments

## Basic completion
autoload -Uz compinit
compinit
_comp_options+=(globdots)

## Colors
autoload -Uz colors && colors

## Useful Functions (needed for plugins)
source "$ZDOTDIR/zsh-functions"
source "$HOME/dotfiles/aliases"
### Plugins
zsh_add_plugin "zsh-users/zsh-autosuggestions"
zsh_add_plugin "zsh-users/zsh-syntax-highlighting"
zsh_add_plugin "hlissner/zsh-autopair"

## Bindings
### Accept autosuggestion with Up arrow only if visible, otherwise do history search
function smart-up-line-or-autosuggest() {
  if [[ -n "$ZSH_AUTOSUGGEST_BUFFER" ]]; then
    zle autosuggest-accept
  else
    zle up-line-or-search
  fi
}
zle -N smart-up-line-or-autosuggest
bindkey '^[[A' smart-up-line-or-autosuggest
### Make sure incremental search works
bindkey '^[[B' down-line-or-search

## ALL EVAL AND EXPORTS FROM PACKAGES
eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship/starship.toml
eval "$(zoxide init zsh)"

if [ -n "$DISPLAY" ]; then xset r rate 300 25; fi

export PATH="$PATH:$HOME/.local/scripts"
export PATH="$HOME/.local/bin:$PATH"
