# Dotfiles

Portable shell/editor/terminal setup for Linux and macOS.

## Managed modules

- `ghostty`
- `lazygit`
- `nvim`
- `opencode`
- `starship`
- `tmux`
- `zsh`

## New machine quickstart

### 1) Clone

```bash
git clone https://github.com/alphiree/dotfiles.git "$HOME/dotfiles"
cd "$HOME/dotfiles"
```

### 2) Bootstrap (recommended)

```bash
make bootstrap
```

`make bootstrap` will:

- link dotfile modules into `~/.config`
- install/configure zsh files (`~/.zshenv`, `~/.zprofile`)
- install platform packages/tools (Linux: `dev-bootstrap.sh`, macOS: `_macos_setup/Makefile`)

### 3) Optional tasks

```bash
make shell-chsh   # also set default shell to zsh
make opencode     # install opencode plugin dependencies
make doctor       # validate links and portability checks
```

## Common targets

- `make link` - link modules only
- `make packages` - install packages only
- `make shell` - setup zsh without changing default shell
- `make shell-chsh` - setup zsh and change default shell
- `make doctor` - run reproducibility checks

## Linking strategy

This repo currently uses a small custom linker via:

```bash
make link
```

That calls `dotfiles-setup.sh` and symlinks selected modules into `~/.config`.

GNU Stow was considered, but is intentionally deferred. The current layout already works with `make link`; moving to Stow would require restructuring modules into a Stow-style tree and should be a separate cleanup if needed later.

## Core CLI dependencies

- `fd` - used by Telescope file search in Neovim
- `ripgrep` / `rg` - used by Telescope live grep
- `fzf` - used by `tmux-sessionizer`
- `tree-sitter` - used by current Neovim Treesitter setup
- `uv` - Python tooling and optional Neovim `pynvim` provider setup

## Notes

- Machine-specific customizations should go in `~/.config/zsh/local.zsh` (not tracked).
- Neovim config targets `0.12+`; Linux bootstrap links the upstream `v0.12.0` binary into `~/.local/bin` if the distro package is older.
- `zsh/.zshrc` now guards optional tools (`starship`, `zoxide`, `opencode`) so first startup works on clean machines.
- If setup scripts detect an existing config target, they backup by default.
- The old `kitty/` config is retained for reference; new default linking uses `ghostty/`.
- Phone dictation workflow notes live in `phonegpt/README.md`; tmux keeps only generic paste helpers under `tmux/scripts/`.
