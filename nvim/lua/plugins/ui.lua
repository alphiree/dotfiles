local M = {}

local function clear_lualine_background(theme)
	if vim.env.NVIM_TRANSPARENT == "0" then
		return theme
	end

	for _, mode in ipairs({ "normal", "insert", "visual", "replace", "command", "terminal", "inactive" }) do
		local sections = theme[mode]
		if sections then
			for name, section in pairs(sections) do
				local original_bg = section.bg
				section.bg = "none"
				if name == "a" and original_bg and original_bg ~= "none" and original_bg ~= "NONE" then
					section.fg = original_bg
				end
			end
		end
	end

	return theme
end

function M.setup()
	vim.cmd([[highlight StatusLine guibg=NONE ctermbg=NONE]])
	vim.cmd([[highlight StatusLineNC guibg=NONE ctermbg=NONE]])

	local lualine_theme = clear_lualine_background(require("lualine.themes.monokai-pro"))

	require("lualine").setup({
		options = {
			theme = lualine_theme,
			component_separators = "",
			section_separators = "",
		},
		sections = {
			lualine_a = { "mode" },
			lualine_b = {
				function()
					local count = 0
					for _, buffer in ipairs(vim.api.nvim_list_bufs()) do
						if vim.api.nvim_buf_is_loaded(buffer) and vim.fn.buflisted(buffer) == 1 then
							count = count + 1
						end
					end
					return "B:" .. count
				end,
				"branch",
				"diagnostics",
			},
			lualine_c = {
				{ "filename", path = 1 },
			},
			lualine_x = {
				"venv-selector",
				"encoding",
				"fileformat",
				"filetype",
			},
		},
	})
end

return M
