# macOS setup

Command-first setup notes for using these dotfiles on macOS with iTerm2, tmux, zsh, Starship, and Neovim.

## 1. Install command line tools

```bash
xcode-select --install
```

## 2. Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After install, follow Homebrew's printed shell instructions so `brew` is on `PATH`.

## 3. Clone dotfiles

```bash
git clone https://github.com/alphiree/dotfiles.git "$HOME/dotfiles"
cd "$HOME/dotfiles"
```

## 4. Install packages

Either use the repo helper:

```bash
make packages-macos
```

or install manually:

```bash
brew install git make curl wget unzip go npm \
  tmux neovim starship zoxide lazygit \
  ripgrep fd fzf tree-sitter-cli uv

brew install --cask iterm2 font-jetbrains-mono-nerd-font
```

Notes:

- `fd` is used by Telescope file search in Neovim.
- `ripgrep`/`rg` is used by Telescope live grep.
- `fzf` is used by `tmux-sessionizer`.
- `tree-sitter-cli` provides the `tree-sitter` executable required by the current Neovim Treesitter parser install/build step.
- `uv` is used for Python tooling, including the optional Neovim Python provider.

## 5. Link configs

This repo currently uses its own linker, not GNU Stow.

For a minimal macOS work setup, link only the configs normally needed on macOS:

```bash
make link LINK_FLAGS="--yes --modules lazygit,nvim,starship,tmux,zsh"
```

That creates links such as:

```text
~/.config/lazygit  -> ~/dotfiles/lazygit
~/.config/nvim     -> ~/dotfiles/nvim
~/.config/starship -> ~/dotfiles/starship
~/.config/tmux     -> ~/dotfiles/tmux
~/.config/zsh      -> ~/dotfiles/zsh
```

To link all default modules instead, run:

```bash
make link
```

GNU Stow was considered, but is intentionally deferred for now. The current layout already works with `make link`; moving to Stow would require restructuring modules into a Stow-style tree and should be a separate cleanup if needed later.

## 6. zsh

After linking `zsh`, zsh still needs to know that its config lives in `~/.config/zsh`. Run:

```bash
make shell
```

This does not relink the config and does not change the default shell. It only ensures zsh is installed and adds this line to `~/.zshenv` and `~/.zprofile` if missing:

```bash
export ZDOTDIR="$HOME/.config/zsh"
```

If you also want to set zsh as the default shell, run:

```bash
make shell-chsh
```

You can verify the setup with:

```bash
grep ZDOTDIR ~/.zshenv ~/.zprofile
ls -ld ~/.config/zsh
```

Machine-local shell overrides should go in:

```text
~/.config/zsh/local.zsh
```

Do not commit machine-specific paths.

## 7. iTerm2 profile

Import the repo profile:

```text
iTerm2 Settings → Profiles → Other Actions → Import JSON Profiles
```

Select:

```text
~/dotfiles/iterm2/profile.json
```

Then select the imported profile named `Dotfiles Dark`.

The iTerm2 global hotkey is not reliably stored in an importable profile JSON. Configure it manually:

```text
iTerm2 Settings → Keys → Hotkey → Create a Dedicated Hotkey Window
```

Suggested hotkey:

```text
Ctrl + Shift + \
```

Use the `Dotfiles Dark` profile for the hotkey window.

## 8. tmux plugins

Start tmux:

```bash
tmux
```

Install plugins with TPM:

```text
Ctrl-b I
```

Session restore bindings from `tmux-resurrect`:

```text
Ctrl-b Ctrl-s  save session
Ctrl-b Ctrl-r  restore session
```

`tmux-continuum` auto-saves every 15 minutes.

## 9. Neovim 0.12+

This config targets Neovim `>= 0.12`.

Verify:

```bash
nvim --version
nvim --headless '+qa'
```

### Python provider

The Neovim config can use Python through `pynvim`. On macOS, avoid relying on slow random Python environment discovery.

Recommended setup for Neovim `0.12+`:

```bash
uv tool install --upgrade pynvim
uv tool update-shell
```

Restart the shell after `uv tool update-shell`, then verify:

```bash
command -v pynvim-python
nvim --headless '+checkhealth provider' '+qa'
```

Neovim `0.12+` should auto-detect `pynvim-python` when it is on `PATH`.

Only add a machine-local override if auto-detection is slow or fails:

```lua
-- ~/.config/nvim/lua/core/local.lua
vim.g.python3_host_prog = "pynvim-python"
```

## 10. Validate

```bash
make doctor
```
