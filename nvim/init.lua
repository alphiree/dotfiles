if vim.fn.has("nvim-0.12") == 0 then
	vim.api.nvim_err_writeln("This config targets Neovim >= 0.12. Current: " .. tostring(vim.version()))
	return
end

local python_host_prog = vim.env.NVIM_PYTHON3_HOST_PROG
if python_host_prog and python_host_prog ~= "" then
	vim.g.python3_host_prog = python_host_prog
end

vim.g.loaded_ruby_provider = 0
vim.g.loaded_perl_provider = 0
vim.g.loaded_node_provider = 0

require("core.keymaps")
require("core.options")
require("core.autocmd")
require("core.transparency")
require("core.lsp")
require("core.pack-bootstrap")

pcall(require, "core.local")
