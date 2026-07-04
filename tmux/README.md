# tmux setup

Minimal tmux config for a portable dev workflow.

## Current version

Tested with:

```bash
tmux 3.6a
```

## Install tmux

Arch Linux:

```bash
sudo pacman -S tmux
```

macOS:

```bash
brew install tmux
```

## Plugins

This config uses TPM with:

- `christoomey/vim-tmux-navigator`
- `tmux-plugins/tmux-resurrect`
- `tmux-plugins/tmux-continuum`

Install plugins inside tmux:

```text
prefix + I
```

Default prefix is:

```text
Ctrl-b
```

## Session restore

`tmux-resurrect` allows manual save/restore:

```text
prefix + Ctrl-s  save session
prefix + Ctrl-r  restore session
```

`tmux-continuum` auto-saves every 15 minutes and restores when a new tmux server starts.

## Local status

The right status line shows host name and battery through:

```text
scripts/battery-status.sh
```

The script path is resolved relative to `tmux.conf` via `#{d:current_file}`, so it does not depend on an absolute `/home/...` path.

The script uses only built-in OS facilities:

- Linux: `/sys/class/power_supply`
- macOS: `pmset`
