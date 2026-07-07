local M = {}

function M.setup()
	require("venv-selector").setup({
		options = {
			notify_user_on_venv_activation = true,
			statusline_func = {
				lualine = function()
					local venv_path = require("venv-selector").venv()
					if not venv_path or venv_path == "" then
						return ""
					end

					local venv_name = vim.fn.fnamemodify(venv_path, ":t")
					if not venv_name or venv_name == "" then
						return ""
					end

					return "🐍 " .. venv_name .. " "
				end,
			},
		},
	})
end

return M
