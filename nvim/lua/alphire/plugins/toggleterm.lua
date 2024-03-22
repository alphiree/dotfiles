return {
	"akinsho/toggleterm.nvim",
	tag = "*",
	config = function()
		local toggleterm = require("toggleterm")
		toggleterm.setup({
			open_mapping = [[<c-\>]],
			hide_number = true,
			start_in_insert = true,
			direction = "float", -- vertical | float | tab
			shade_terminals = true,
		})
	end,
}
