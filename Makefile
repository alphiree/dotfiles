SHELL := /usr/bin/env bash
UNAME_S := $(shell uname -s)

DEFAULT_MODULES := kitty,lazygit,nvim,opencode,starship,tmux,zsh
LINK_FLAGS ?= --yes --modules $(DEFAULT_MODULES)
SHELL_SETUP_FLAGS ?= --yes --no-chsh
BOOTSTRAP_FLAGS ?= --yes

.PHONY: help bootstrap bootstrap-linux bootstrap-macos link shell shell-chsh packages packages-linux packages-macos opencode doctor

help:
	@printf '%s\n' \
	  'Available targets:' \
	  '  make bootstrap       -> run full setup for this OS' \
	  '  make link            -> symlink selected dotfile modules' \
	  '  make packages        -> install packages/tools for this OS' \
	  '  make shell           -> setup zsh without changing default shell' \
	  '  make shell-chsh      -> setup zsh and change default shell' \
	  '  make opencode        -> install opencode plugin dependencies' \
	  '  make doctor          -> validate local dotfiles health'

bootstrap:
ifeq ($(UNAME_S),Darwin)
	@$(MAKE) bootstrap-macos
else
	@$(MAKE) bootstrap-linux
endif

bootstrap-linux: link shell packages-linux

bootstrap-macos: link shell packages-macos

link:
	@DOTFILES_DIR="$(CURDIR)" ./dotfiles-setup.sh $(LINK_FLAGS)

shell:
	@./zsh/setup-zsh.sh $(SHELL_SETUP_FLAGS)

shell-chsh:
	@./zsh/setup-zsh.sh --yes

packages: packages-$(shell [ "$(UNAME_S)" = "Darwin" ] && echo macos || echo linux)

packages-linux:
	@./dev-bootstrap.sh $(BOOTSTRAP_FLAGS)

packages-macos:
	@$(MAKE) -C _macos_setup

opencode:
	@npm --prefix opencode install

doctor:
	@./doctor.sh
