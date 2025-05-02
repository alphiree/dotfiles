return {
	"nvim-lualine/lualine.nvim",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	config = function()
		-- Add the below command if you want to force the lua line to have a bg transparent
		vim.cmd([[
            highlight StatusLine     guibg=NONE ctermbg=NONE
            highlight StatusLineNC   guibg=NONE ctermbg=NONE
          ]])
		local auto_theme_custom = require("lualine.themes.monokai-pro")
		-- local auto_theme_custom = require("lualine.themes.gruvbox-material")
		auto_theme_custom.normal.c.bg = "none"
		require("lualine").setup({
			options = {
				-- theme = "catppuccin",
				theme = auto_theme_custom,
			},
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
					-- "diff",
					"diagnostics",
				},
				lualine_c = {
					{ "filename", path = 1 },
				},
			},
		})
	end,
}
