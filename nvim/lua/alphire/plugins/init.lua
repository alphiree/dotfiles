return {
	-- Maximizing Windows
	"szw/vim-maximizer",
	-- Plenary to use different functions
	"nvim-lua/plenary.nvim",
	-- To fix the delete buffer issue redirecting to nvimtree
	"famiu/bufdelete.nvim",
	-- Github CoPilot
	-- "github/copilot.vim",
	-- Use auto-close plugin
	{
		"windwp/nvim-autopairs",
		event = "InsertEnter",
		config = true,
		-- use opts = {} for passing setup options
		-- this is equivalent to setup({}) function
	},
}
