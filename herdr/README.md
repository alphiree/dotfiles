# Herdr setup

Herdr is a terminal workspace and agent multiplexer. This module is linked to:

```text
~/.config/herdr
```

## Install

Arch Linux/AUR, prebuilt upstream binary:

```bash
yay -S herdr-bin
```

Official installer alternative:

```bash
curl -fsSL https://herdr.dev/install.sh | sh
```

## Link config

From the dotfiles repo:

```bash
make link
```

Or link only this module:

```bash
./dotfiles-setup.sh --yes --modules herdr
```

Reload a running Herdr server after config edits:

```bash
herdr server reload-config
```

## Model

Herdr's hierarchy is:

```text
session -> workspace -> tab -> pane/agent
```

Recommended workflow:

- Use the default Herdr session for normal work: `herdr`
- Use one workspace per project/repo/task
- Use tabs for layouts inside a workspace, such as `agents`, `server`, `logs`, or `review`
- Use panes for shells, servers, tests, and AI agents

This differs from tmux, where a tmux session often acts as both the session namespace and project workspace. In Herdr, that project-level unit is usually a workspace.

## Keybindings

Prefix is `Ctrl-b`.

Useful defaults in this config:

```text
Ctrl+h/j/k/l         focus Neovim splits first, then Herdr panes at edges
prefix+h/j/k/l       focus Herdr panes directly
prefix+r, h/j/k/l   resize panes
prefix+c             new tab after current, without name popup
prefix+n / prefix+p next / previous tab
prefix+,             rename tab, tmux-style
prefix+v or prefix+% split right
prefix+- or prefix+" split down
prefix+w             workspace picker
prefix+s or prefix+g session navigator / goto picker
prefix+t or prefix+Shift-s settings/theme UI
prefix+f             sessionizer project/workspace picker
prefix+b             toggle sidebar
prefix+d or prefix+q detach
```

## Tmux-like new tab behavior

`prefix+c` is backed by `scripts/new-tab-after-current.sh` instead of Herdr's built-in `new_tab` binding.

It creates a tab immediately, focuses it, and moves it beside the current tab with Herdr's socket API. Tab labels stay as Herdr's generated number labels, so manual renames are not touched.

Reload after edits:

```bash
herdr server reload-config
```

## Ctrl+h/j/k/l Vim/Herdr navigation

This module uses Option B: `Ctrl+h/j/k/l` is bound to custom shell commands in `config.toml`, backed by `scripts/navigate-vim-herdr.sh`.

This avoids a Herdr plugin dependency while preserving `vim-tmux-navigator`-style behavior:

- inside Neovim, move between Neovim splits first
- at a Neovim split edge, cross into the neighboring Herdr pane
- outside Neovim, move Herdr pane focus directly

The plain Herdr direct-binding approach was tested and rejected because it steals `Ctrl+h/j/k/l` from Neovim.

## Sessionizer

This module includes a Herdr equivalent of `tmux-sessionizer`:

```text
scripts/herdr-sessionizer.sh
```

Keybinding:

```text
prefix+f
```

It opens `fzf` in a Herdr popup, selects from the same project roots as the tmux sessionizer, then focuses an existing workspace with the selected label or creates a new workspace with that directory as cwd.

Manual usage:

```bash
~/.config/herdr/scripts/herdr-sessionizer.sh
~/.config/herdr/scripts/herdr-sessionizer.sh ~/dotfiles
```

## Agent integrations

Install integrations after Herdr is installed. Start with Pi, then add other agents you actually use:

```bash
herdr integration install pi
herdr integration install opencode
herdr integration install claude
herdr integration install codex
herdr integration status
```

Integrations can provide lifecycle state, native session identity, or both. This improves the sidebar status (`working`, `blocked`, `done`, `idle`) and lets supported agents resume their native conversations after a Herdr server restart.

`resume_agents_on_restore = true` only enables Herdr's restore behavior. It does not replace the integrations: supported agents need a current integration to report the native session reference that Herdr later resumes.

## Session restore note

`resume_agents_on_restore = true` is enabled in `config.toml`. This lets supported AI-agent panes restart with their native session references after a Herdr server restart when the relevant integration is installed.

`experimental.pane_history` is intentionally disabled because saved terminal output can contain secrets, prompts, tokens, or command output.
