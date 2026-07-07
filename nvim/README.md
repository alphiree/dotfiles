# Neovim Config

Personal Neovim configuration focused on Python, TypeScript/JavaScript, Go, SQL, and Markdown workflows.

## Highlights

- Neovim `0.12+` native plugin management via `vim.pack`
- Native LSP configuration with `vim.lsp.config()` + `vim.lsp.enable()`
- Native LSP completion with `vim.lsp.completion` + `vim.snippet`
- Formatting with `conform.nvim`
- SQL linting with `nvim-lint`
- Fast search/navigation with Telescope + Oil
- Git hunks/blame/diff through Gitsigns
- Built-in commenting via native `gc`/`gcc`

## Prerequisites

- Neovim `>= 0.12`
- `git`
- `fd` for Telescope file search
- `ripgrep` for Telescope live grep
- `tree-sitter-cli` `>= 0.26.1` for the current nvim-treesitter branch. It must provide a `tree-sitter` executable on `PATH`.
- Optional: `uv tool install pynvim` or `NVIM_PYTHON3_HOST_PROG` for Python provider support

## Install

From a clean machine, place this folder at `~/.config/nvim` and start Neovim:

```bash
nvim
```

Plugins are installed by `vim.pack` into Neovim's package directory. External LSP servers/tools are installed by Mason.

## Machine-specific setup

Do not hardcode machine paths in tracked files.

### Python provider

The Python provider only works when Neovim can find a Python interpreter with `pynvim` installed. Installing `pynvim` somewhere is not always enough; on macOS especially, provider lookup can be slow or inconsistent if Neovim has to scan Python environments.

Recommended setup with `uv` for Neovim `0.12+`:

```bash
uv tool install --upgrade pynvim
uv tool update-shell
```

Restart the shell after `uv tool update-shell`, then verify:

```bash
command -v pynvim-python
nvim --headless '+checkhealth provider' '+qa'
```

For Neovim `0.12+`, `pynvim` installed this way should be auto-detected through the `pynvim-python` tool on `PATH`.

Only add an explicit provider if auto-detection is slow or fails. Prefer a machine-local setting, not a tracked path:

```lua
-- lua/core/local.lua, gitignored
vim.g.python3_host_prog = "pynvim-python"
```

`lua/core/local.lua` is gitignored and should hold machine-only overrides.

## Config structure

- `init.lua` bootstrap entrypoint
- `nvim-pack-lock.json` native `vim.pack` lockfile
- `lua/core/pack-bootstrap.lua` plugin install/load list
- `lua/core/lsp.lua` diagnostics, LSP keymaps, native completion, signature expansion
- `lua/core/` editor options, keymaps, autocmds, transparency
- `lua/plugins/` plugin setup modules
- `lua/plugins/lsp.lua` Mason, LSP server list, formatting, linting

## Useful commands

- `:lua vim.pack.update()` native plugin update review
- `:lua vim.pack.get()` inspect native-pack plugins
- `:Mason` LSP/tool installer UI
- `:lsp restart` restart LSP clients
- `<leader>ff` find files
- `<leader>fs` grep in project
- `-` open Oil file explorer
- `<leader>mp` format file/range
- `gc`/`gcc` native commenting

## Maintenance

- Update plugins: `:lua vim.pack.update()`
- Update parsers: `:TSUpdate`
- Health checks: `:checkhealth`
- Format Lua config: `stylua nvim/lua nvim/init.lua`
- Headless startup check: `nvim --headless "+qa"`

## Changelog

- See `nvim/CHANGELOG.md` for a running record of config changes.
