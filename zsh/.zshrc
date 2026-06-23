#!/usr/bin/env zsh

## BASIC CONFIG
export ZDOTDIR="${ZDOTDIR:-$HOME/.config/zsh}"
export VISUAL="${VISUAL:-nvim}"
export EDITOR="${EDITOR:-nvim}"
HISTSIZE=10000
SAVEHIST=100000
HISTFILE="$HOME/.zsh_history"
setopt appendhistory

## Simple default-like prompt (used before starship loads)
PS1='%n@%m %~ %# '

## Basic options
setopt autocd extendedglob nomatch
setopt interactive_comments

## Path helpers
path_prepend_if_dir() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  [[ ":$PATH:" == *":$dir:"* ]] || export PATH="$dir:$PATH"
}

path_append_if_dir() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  [[ ":$PATH:" == *":$dir:"* ]] || export PATH="$PATH:$dir"
}

path_prepend_if_dir "$HOME/.local/bin"
path_prepend_if_dir "$HOME/.opencode/bin"
path_append_if_dir "$HOME/.local/scripts"

## Basic completion
autoload -Uz compinit
compinit
_comp_options+=(globdots)

## Colors
autoload -Uz colors && colors

## Useful Functions (needed for plugins)
source "$ZDOTDIR/zsh-functions"
[[ -f "$HOME/dotfiles/aliases" ]] && source "$HOME/dotfiles/aliases"

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

export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

## Optional tool init (safe on fresh machines)
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

if [[ -n "$DISPLAY" ]] && command -v xset >/dev/null 2>&1; then
  xset r rate 300 25
fi

## Machine-local, untracked overrides
[[ -f "$ZDOTDIR/local.zsh" ]] && source "$ZDOTDIR/local.zsh"
