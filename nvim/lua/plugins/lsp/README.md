# LSP Notes (Python Data/AI Workflow)

This folder controls language servers, formatting, linting, and completion for Neovim.

## Files and purpose

- `mason.lua`: installs external LSP servers/tools.
- `lsp-config.lua`: enables and configures active LSP servers.
- `nvim-cmp.lua`: completion capability integration (`cmp-nvim-lsp`, `lazydev`, file ops).
- `lsp-formatting.lua`: formatters via `conform.nvim`.
- `lsp-linting.lua`: linters via `nvim-lint`.
- `signature-expand.lua`: custom snippet helper for function arguments.

## Current Python stack

- LSP servers: `basedpyright`, `ruff`
- Formatter: `ruff_format`
- Import organizer: `ruff_organize_imports`
- Trigger formatting manually: `<leader>mp`
- Auto format on save: enabled in `lsp-formatting.lua`

## Where to change what

### 1) Add or remove installed tools/servers

Edit `mason.lua`:

- `mason_lspconfig.setup({ ensure_installed = { ... } })` for LSP servers.
- `mason_tool_installer.setup({ ensure_installed = { ... } })` for non-LSP tools (formatters/linters).

Examples:

- Add Python server: add server name to LSP `ensure_installed`.
- Add formatter/linter tool: add tool name to tool-installer `ensure_installed`.

### 2) Configure active server behavior

Edit `lsp-config.lua`:

- Add server entry inside `servers = { ... }`.
- Add server-specific settings in that server table.
- Server is enabled through `vim.lsp.config(server, opts)` and `vim.lsp.enable(server)`.

### 3) Configure formatting per filetype

Edit `lsp-formatting.lua`:

- `formatters_by_ft = { ... }` maps filetypes to formatter chains.
- Python currently uses Ruff format + import organize.
- `format_on_save` controls auto-format behavior.

### 4) Configure linting per filetype

Edit `lsp-linting.lua`:

- `lint.linters_by_ft = { ... }` maps filetypes to linters.
- Lint runs on `BufEnter`, `BufWritePost`, and `InsertLeave`.

### 5) Completion behavior

Edit `nvim-cmp.lua` and top-level `../nvim-cmp.lua`:

- `nvim-cmp.lua` in this folder integrates completion capabilities into LSP.
- top-level `lua/plugins/nvim-cmp.lua` controls UI/mappings/snippets/sources.

## Recommended Python data/AI additions (when needed)

- Keep: `basedpyright` + `ruff` (fast baseline).
- Optional add-ons by workflow:
  - notebooks: `jupyter`/`python-lsp-server`-style integrations (if needed later)
  - SQL-heavy projects: keep `sqlls` and `sqlfluff`
  - docs-heavy repos: keep `marksman`

## Quick edit checklist

1. Update `mason.lua` (install targets).
2. Update `lsp-config.lua` (server config/enable).
3. Update `lsp-formatting.lua` and/or `lsp-linting.lua`.
4. Open Neovim and run `:Mason` to verify installs.
5. Run `:checkhealth` and test on a Python file.

## Practical defaults to remember

- Add servers in two places: install list (`mason.lua`) + config table (`lsp-config.lua`).
- Add tools in two places: install list (`mason.lua`) + filetype mapping (`lsp-formatting.lua` or `lsp-linting.lua`).
- If diagnostics/completion look missing, confirm LSP attached (`:LspInfo`).
