# Makefile.macos — macOS setup using Homebrew

BREW := $(shell command -v brew 2>/dev/null)

.PHONY: all install_brew core terminal python neovim tmux misc

all: install_brew core terminal python neovim tmux misc

install_brew:
ifndef BREW
	@echo "Installing Homebrew..."
	/bin/bash -c "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
	@echo "Homebrew already installed."
endif

core:
	@for pkg in git make curl wget unzip go npm ripgrep fd fzf; do \
		if ! brew list --formula | grep -Fxq "$$pkg"; then \
			echo "Installing $$pkg..."; brew install $$pkg; \
		else echo "$$pkg already installed."; fi; \
	done

terminal:
	@for pkg in starship zoxide lazygit; do \
		if ! brew list --formula | grep -Fxq "$$pkg"; then \
			echo "Installing $$pkg..."; brew install $$pkg; \
		else echo "$$pkg already installed."; fi; \
	done
	@echo "Installing JetBrains Mono Nerd Font..."
	@if ! brew list --cask | grep -q "font-jetbrains-mono-nerd-font"; then \
		brew install --cask font-jetbrains-mono-nerd-font; \
	else echo "JetBrains Mono Nerd Font already installed."; fi


python:
	@for pkg in python3 pyenv pyenv-virtualenv uv; do \
		if ! brew list --formula | grep -Fxq "$$pkg"; then \
			echo "Installing $$pkg..."; brew install $$pkg; \
		else echo "$$pkg already installed."; fi; \
	done

neovim:
	@for pkg in neovim lua luarocks; do \
		if ! brew list --formula | grep -Fxq "$$pkg"; then \
			echo "Installing $$pkg..."; brew install $$pkg; \
		else echo "$$pkg already installed."; fi; \
	done

tmux:
	@if ! brew list --formula | grep -q tmux; then \
		echo "Installing tmux..."; \
		brew install tmux; \
	else \
		echo "tmux already installed."; \
	fi
	@if [ ! -d "$$HOME/.config/tmux/tpm_plugin/tpm" ]; then \
		echo "Installing tmux plugin manager (TPM)..."; \
		mkdir -p "$$HOME/.config/tmux/tpm_plugin"; \
		git clone https://github.com/tmux-plugins/tpm "$$HOME/.config/tmux/tpm_plugin/tpm"; \
	else \
		echo -e "\033[1;32m-->\033[0m tmux plugin manager already installed, skipping."; \
	fi

misc:
	@echo "macOS setup complete."

