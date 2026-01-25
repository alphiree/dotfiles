return {
	"linux-cultist/venv-selector.nvim",
	dependencies = {
		"neovim/nvim-lspconfig",
	},
	ft = "python", -- Load when opening Python files
	keys = {
		{ "<leader>vs", "<cmd>VenvSelect<cr>" },
	},
	opts = {
		search = {
			-- workspace = {
			-- 	command = "fd /bin/python$ $CWD --full-path -H -I",
			-- },
		},
		options = {
			notify_user_on_venv_activation = true,
			statusline_func = {
				lualine = function()
					local venv_path = require("venv-selector").venv()
					if not venv_path or venv_path == "" then
						return ""
					end

					local venv_name = vim.fn.fnamemodify(venv_path, ":t")
					if not venv_name then
						return ""
					end

					local output = "🐍 " .. venv_name .. " " -- Changes only the icon but you can change colors or use powerline symbols here.
					return output
				end,
			},
		},
	},
}
