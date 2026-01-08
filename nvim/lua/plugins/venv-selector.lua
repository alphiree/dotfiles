return {
	"linux-cultist/venv-selector.nvim",
	dependencies = {
		"neovim/nvim-lspconfig",
		{ "nvim-telescope/telescope.nvim" },
	},
	config = function()
		require("venv-selector").setup({
			-- Your options go here
			name = { "venv", ".venv" },
			-- auto_refresh = true,
			path = 0,
			stay_on_this_version = true,
		})
	end,
	ft = "python",
	event = "VeryLazy", -- Optional: needed only if you want to type `:VenvSelect` without a keymapping
	keys = {
		-- Keymap to open VenvSelector to pick a venv.
		{ "<leader>vs", "<cmd>VenvSelect<cr>" },
		-- Keymap to retrieve the venv from a cache (the one previously used for the same project directory).
		{ "<leader>vc", "<cmd>VenvSelectCached<cr>" },
		-- Keymap to view your current venv.
		{ "<leader>va", "<cmd>VenvSelectCurrent<cr>" },
	},
	search = {
		workspace = {
			-- command = "fd /bin/python$ $WORKSPACE_PATH --full-path --color never -E /proc -unrestricted",
			command = "fd '/bin/python$' $CWD --full-path -H -I",
		},
	},
}
