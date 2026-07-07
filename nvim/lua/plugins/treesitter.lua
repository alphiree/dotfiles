local M = {}

local parsers = {
	"bash",
	"css",
	"dockerfile",
	"gitignore",
	"go",
	"html",
	"javascript",
	"json",
	"lua",
	"markdown",
	"markdown_inline",
	"python",
	"query",
	"tsx",
	"typescript",
	"vim",
	"yaml",
}

local filetypes = {
	"bash",
	"css",
	"dockerfile",
	"gitignore",
	"go",
	"html",
	"javascript",
	"javascriptreact",
	"json",
	"lua",
	"markdown",
	"python",
	"query",
	"sh",
	"tsx",
	"typescript",
	"typescriptreact",
	"vim",
	"yaml",
	"zsh",
}

function M.setup()
	local treesitter = require("nvim-treesitter")
	treesitter.setup({
		install_dir = vim.fn.stdpath("data") .. "/site",
	})

	pcall(function()
		treesitter.install(parsers)
	end)

	vim.api.nvim_create_autocmd("FileType", {
		group = vim.api.nvim_create_augroup("UserTreesitterStart", { clear = true }),
		pattern = filetypes,
		callback = function()
			pcall(vim.treesitter.start)
			pcall(function()
				vim.bo.indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
			end)
		end,
	})

	require("nvim-ts-autotag").setup({})
	require("treesitter-context").setup({
		enable = true,
		max_lines = 3,
	})
end

return M
