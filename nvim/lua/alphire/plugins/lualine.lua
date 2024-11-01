return {
	"nvim-lualine/lualine.nvim",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	config = function()
		-- local auto_theme_custom = require("lualine.themes.monokai-pro")
		-- auto_theme_custom.normal.c.bg = "none"
		require("lualine").setup({
			-- options = {
			-- 	theme = "catppuccin",
			-- 	-- theme = auto_theme_custom,
			-- 	-- ... the rest of your lualine config
			-- },
			sections = {
				lualine_a = {
					"mode",
				},
				lualine_b = {
					-- shows the number of buffers
					{
						function()
							local count = 0
							for _, buffer in ipairs(vim.api.nvim_list_bufs()) do
								if vim.api.nvim_buf_is_loaded(buffer) and vim.fn.buflisted(buffer) == 1 then
									count = count + 1
								end
							end
							return "B:" .. count
						end,
					},
					"branch",
					"diff",
					"diagnostics",
				},
				lualine_c = {
					{ "filename", path = 1 },
				},
			},
		})
	end,
}
