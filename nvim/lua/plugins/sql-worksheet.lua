local M = {}

function M.setup()
	require("sql_worksheet").setup({})

	vim.api.nvim_create_autocmd("FileType", {
		group = vim.api.nvim_create_augroup("SqlWorksheetMappings", { clear = true }),
		pattern = "sql",
		callback = function(args)
			vim.keymap.set("x", "<leader>sr", ":'<,'>SqlWorksheetRun<CR>", {
				buffer = args.buf,
				silent = true,
				desc = "Run selected SQL",
			})
		end,
	})
end

return M
