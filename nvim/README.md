# Neovim Config

Personal Neovim configuration focused on Python, TypeScript/JavaScript, Go, SQL, and Markdown workflows.

## Highlights

- Lazy-loaded plugin management via `lazy.nvim`
- LSP + diagnostics + code actions
- Formatting with `conform.nvim`
- Linting with `nvim-lint`
- Fast search/navigation with Telescope + Oil
- Git workflow support through Gitsigns, Fugitive, and Lazygit

## Prerequisites

- Neovim `>= 0.10`
- `git`
- `fd` (for Telescope file search)
- `ripgrep` (for Telescope live grep)
- Optional: `python3` + `pynvim` for Python provider

## Install

From a clean machine, place this folder at `~/.config/nvim` and start Neovim:

```bash
nvim
```

Plugins and external tools are installed by `lazy.nvim` + Mason.

## Machine-specific setup

Do not hardcode machine paths in tracked files.

1) Optional Python provider env var:

```bash
export NVIM_PYTHON3_HOST_PROG="/absolute/path/to/python"
```

2) Optional local overrides:

- Copy `lua/core/local.example.lua` to `lua/core/local.lua`
- Add machine-only overrides there
- `lua/core/local.lua` is gitignored

## Config structure

- `init.lua` bootstrap entrypoint
- `lua/core/lazy-bootstrap.lua` lazy.nvim bootstrap and plugin imports
- `lua/core/` editor options, keymaps, and autocmds
- `lua/lsp.lua` shared LSP keymaps and diagnostics UI
- `lua/plugins/` plugin specs
- `lua/plugins/lsp/` LSP, formatter, linter, and Mason specs
- `lua/plugins/themes/` active theme specs
- `lua/plugins/archived/` disabled references only

## Useful commands

- `:Lazy` plugin manager UI
- `:Mason` LSP/tool installer UI
- `<leader>ff` find files
- `<leader>fs` grep in project
- `-` open Oil file explorer
- `<leader>mp` format file/range

## Maintenance

- Update plugins: `:Lazy sync`
- Update parsers: `:TSUpdate`
- Health checks: `:checkhealth`
- Format Lua config: `stylua nvim/lua`
- Check formatting in CI/local: `stylua --check nvim/lua`

## CI

GitHub Actions runs:

- `stylua --check nvim/lua`
- headless startup validation with `nvim --headless "+qa"`

## Changelog

- See `nvim/CHANGELOG.md` for a running record of config changes.
