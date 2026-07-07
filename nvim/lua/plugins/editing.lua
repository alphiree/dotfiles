local M = {}

function M.setup()
	require("nvim-autopairs").setup({})

	require("mini.surround").setup({
		mappings = {
			add = "sa",
			delete = "sd",
			find = "sf",
			find_left = "sF",
			highlight = "sh",
			replace = "sr",
			update_n_lines = "sn",
			suffix_last = "l",
			suffix_next = "n",
		},
	})

	require("mini.indentscope").setup({
		symbol = "│",
		options = { try_as_border = true },
	})

	vim.api.nvim_create_autocmd("FileType", {
		group = vim.api.nvim_create_augroup("UserMiniIndentscopeDisable", { clear = true }),
		pattern = {
			"help",
			"mason",
			"oil",
			"TelescopePrompt",
		},
		callback = function()
			vim.b.miniindentscope_disable = true
		end,
	})
end

return M
