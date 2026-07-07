if not vim.pack then
	error("vim.pack is unavailable. This config requires Neovim >= 0.12.")
end

local function gh(repo)
	return "https://github.com/" .. repo
end

vim.api.nvim_create_autocmd("PackChanged", {
	group = vim.api.nvim_create_augroup("UserPackHooks", { clear = true }),
	callback = function(ev)
		local name = ev.data and ev.data.spec and ev.data.spec.name
		local kind = ev.data and ev.data.kind
		if name == "nvim-treesitter" and (kind == "install" or kind == "update") then
			vim.schedule(function()
				pcall(vim.cmd, "TSUpdate")
			end)
		end
	end,
})

vim.pack.add({
	-- dependencies / UI
	gh("nvim-lua/plenary.nvim"),
	gh("nvim-tree/nvim-web-devicons"),
	gh("loctvl842/monokai-pro.nvim"),
	gh("nvim-lualine/lualine.nvim"),

	-- navigation / files
	{ src = gh("nvim-telescope/telescope.nvim"), version = "v0.2.2" },
	gh("stevearc/oil.nvim"),
	gh("christoomey/vim-tmux-navigator"),
	gh("szw/vim-maximizer"),

	-- editing
	gh("windwp/nvim-autopairs"),
	gh("echasnovski/mini.surround"),
	gh("echasnovski/mini.indentscope"),

	-- treesitter
	gh("nvim-treesitter/nvim-treesitter"),
	gh("nvim-treesitter/nvim-treesitter-context"),
	gh("windwp/nvim-ts-autotag"),

	-- git
	gh("lewis6991/gitsigns.nvim"),

	-- language tooling
	gh("mason-org/mason.nvim"),
	gh("mason-org/mason-lspconfig.nvim"),
	gh("WhoIsSethDaniel/mason-tool-installer.nvim"),
	gh("neovim/nvim-lspconfig"),
	gh("folke/lazydev.nvim"),
	gh("stevearc/conform.nvim"),
	gh("mfussenegger/nvim-lint"),
	gh("linux-cultist/venv-selector.nvim"),
}, { confirm = false, load = true })

require("plugins").setup()
