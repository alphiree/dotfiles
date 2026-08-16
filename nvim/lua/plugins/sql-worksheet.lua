local M = {}

function M.setup()
	require("sql_worksheet").setup({
		history_size = 50,
		auto_install = true,
	})

	vim.api.nvim_create_autocmd("FileType", {
		group = vim.api.nvim_create_augroup("SqlWorksheetMappings", { clear = true }),
		pattern = "sql",
		callback = function(args)
			vim.keymap.set("n", "<S-CR>", "<cmd>SqlWorksheetRun<CR>", {
				buffer = args.buf,
				silent = true,
				desc = "Run SQL statement",
			})
			vim.keymap.set("x", "<S-CR>", ":'<,'>SqlWorksheetRun<CR>", {
				buffer = args.buf,
				silent = true,
				desc = "Run selected SQL",
			})
			vim.keymap.set("x", "<leader>sr", ":'<,'>SqlWorksheetRun<CR>", {
				buffer = args.buf,
				silent = true,
				desc = "Run selected SQL",
			})
		end,
	})
end

return M
