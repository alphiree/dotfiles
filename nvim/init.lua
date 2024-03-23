-- initializing core files
require("alphire.core.keymaps")
require("alphire.core.options")

-- intiializing lazy plugin manager
require("alphire.lazy")

-- Disabling the new comment line when creating file

-- Initializing the venv from pyproject.toml in your workspace
vim.api.nvim_create_autocmd("VimEnter", {
	desc = "Auto select virtualenv Nvim open",
	pattern = "*",
	callback = function()
		local venv = vim.fn.findfile("pyproject.toml", vim.fn.getcwd() .. ";")
		if venv ~= "" then
			require("venv-selector").retrieve_from_cache()
		end
	end,
	once = true,
})
