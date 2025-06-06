return {
	"linux-cultist/venv-selector.nvim",
	dependencies = { "neovim/nvim-lspconfig", "nvim-telescope/telescope.nvim", "mfussenegger/nvim-dap-python" },
	config = function()
		require("venv-selector").setup({
			-- Your options go here
			name = { "venv", ".venv" },
			-- auto_refresh = true,
			path = 0,
			stay_on_this_version = true,
		})
		-- Initializing the venv from pyproject.toml in your workspace
		-- Function to set up the autocommand for VimEnter (note: does not work here so better to include this in options lua)
		vim.api.nvim_create_autocmd("VimEnter", {
			desc = "Auto select virtualenv Nvim opens",
			pattern = "*",
			callback = function()
				local pyproject = vim.fn.findfile("pyproject.toml", vim.fn.getcwd() .. ";")
				local pipfile = vim.fn.findfile("Pipfile.lock", vim.fn.getcwd() .. ";")
				local poetrylock = vim.fn.findfile("poetry.lock", vim.fn.getcwd() .. ";")

				if pyproject ~= "" or pipfile ~= "" or poetrylock ~= "" then
					require("venv-selector").retrieve_from_cache()
					print("Virtual environment activated") -- Optional: Debug message
				end
			end,
			once = true,
		})
	end,
	event = "VeryLazy", -- Optional: needed only if you want to type `:VenvSelect` without a keymapping
	keys = {
		-- Keymap to open VenvSelector to pick a venv.
		{ "<leader>vs", "<cmd>VenvSelect<cr>" },
		-- Keymap to retrieve the venv from a cache (the one previously used for the same project directory).
		{ "<leader>vc", "<cmd>VenvSelectCached<cr>" },
		-- Keymap to view your current venv.
		{ "<leader>va", "<cmd>VenvSelectCurrent<cr>" },
	},
}
