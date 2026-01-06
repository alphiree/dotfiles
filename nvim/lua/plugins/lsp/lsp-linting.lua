return {
	"mfussenegger/nvim-lint",
	lazy = true,
	event = { "BufReadPre", "BufNewFile" }, -- to disable, comment this out
	config = function()
		local lint = require("lint")

		-- This is where you configure your linters that you installed via Mason
		lint.linters_by_ft = {
			python = { "mypy" }, -- only mypy as ruff is already configured as lsp
			sql = { "sqlfluff" },
		}

		local lint_augroup = vim.api.nvim_create_augroup("lint", { clear = true })

		vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave" }, {
			group = lint_augroup,
			callback = function()
				lint.try_lint()
			end,
		})

		-- vim.keymap.set("n", "<leader>l", function()
		-- 	lint.try_lint()
		-- end, { desc = "Trigger linting for current file" })
	end,
}
