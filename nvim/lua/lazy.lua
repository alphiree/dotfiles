-- Initializing the lazy.vim plugin manager
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable", -- latest stable release
		lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)

-- Plugins setup (Plugins are in the plugins folder in this directory)
require("lazy").setup({
	spec = {
		{ import = "plugins" },
		{ import = "plugins.themes" },
		{ import = "plugins.lsp" },
	},
})
