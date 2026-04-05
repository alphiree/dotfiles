# Dotfiles

Portable shell/editor/terminal setup for Linux and macOS.

## Managed modules

- `kitty`
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

## Notes

- Machine-specific customizations should go in `~/.config/zsh/local.zsh` (not tracked).
- `zsh/.zshrc` now guards optional tools (`starship`, `zoxide`, `opencode`) so first startup works on clean machines.
- If setup scripts detect an existing config target, they backup by default.
