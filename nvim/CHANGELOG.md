# Changelog

## 2026-04-04

### Re-applied follow-up fixes

- Re-applied Stylua-compatible formatting in `nvim/lua/plugins/comment.lua`.
- Re-applied `<leader>x` fallback logic in `nvim/lua/core/keymaps/plugins.lua` so buffer deletion works with or without `bufdelete.nvim`.
- Re-removed default `bufdelete` loading by deleting `nvim/lua/plugins/bufdelete.lua`.
- Re-removed `bufdelete.nvim` lock entry from `nvim/lazy-lock.json`.
- Re-documented optional `bufdelete` usage in `nvim/lua/plugins/archived/init.lua`.

### Repository cleanup and best-practice pass

- Replaced hardcoded Python provider path with `NVIM_PYTHON3_HOST_PROG` in `nvim/init.lua`.
- Added local machine override pattern via `nvim/lua/core/local.example.lua` and ignored `nvim/lua/core/local.lua` in `.gitignore`.
- Refactored bootstrap entry to `nvim/lua/core/lazy-bootstrap.lua` and removed the old `nvim/lua/lazy.lua` naming conflict.
- Split keymaps into focused modules:
  - `nvim/lua/core/keymaps/general.lua`
  - `nvim/lua/core/keymaps/window.lua`
  - `nvim/lua/core/keymaps/plugins.lua`
- Removed stale `NvimTree` mappings and aligned file explorer keymaps with Oil.
- Removed duplicate Telescope `<leader>ff` mapping.
- Corrected tmux left/right navigation mappings (`<C-h>`/`<C-l>`).
- Made LSP server setup explicit in `nvim/lua/plugins/lsp/lsp-config.lua` using modern `vim.lsp.config` + `vim.lsp.enable`.
- Moved `stylua` from Mason LSP server list to Mason tool installer list in `nvim/lua/plugins/lsp/mason.lua`.
- Simplified cmp-lsp integration in `nvim/lua/plugins/lsp/nvim-cmp.lua`.
- Simplified diagnostic config in `nvim/lua/lsp.lua` (`virtual_text = false`).
- Expanded `nvim/README.md` with setup, structure, maintenance, and CI guidance.
- Added `nvim/.stylua.toml`.
- Added CI workflow `.github/workflows/nvim-practice-check.yml` (Stylua + headless startup check).

### Follow-up fixes after CI/report

- Fixed Stylua indentation in `nvim/lua/plugins/comment.lua`.
- Changed `<leader>x` mapping to robust fallback behavior:
  - uses `:Bdelete` when available
  - falls back to built-in `:bdelete` when `bufdelete.nvim` is not loaded
- Removed active `bufdelete` plugin spec (`nvim/lua/plugins/bufdelete.lua`) so it is not loaded by default.
- Removed stale `bufdelete.nvim` lock entry from `nvim/lazy-lock.json`.
- Kept archived plugin module non-loading and documented optional `bufdelete` line in `nvim/lua/plugins/archived/init.lua`.
