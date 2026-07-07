local M = {}

function M.setup()
	require("monokai-pro").setup({
		transparent_background = vim.env.NVIM_TRANSPARENT ~= "0",
		terminal_colors = true,
		devicons = true,
		styles = {
			comment = { italic = true },
			keyword = { italic = true },
			type = { italic = true },
			storageclass = { italic = true },
			structure = { italic = true },
			parameter = { italic = true },
			annotation = { italic = true },
			tag_attribute = { italic = true },
		},
		filter = "spectrum",
		inc_search = "background",
		background_clear = {
			"telescope",
		},
	})
	vim.cmd.colorscheme("monokai-pro")
end

return M
