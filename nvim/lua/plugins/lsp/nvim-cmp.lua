return {
	"hrsh7th/cmp-nvim-lsp",
	event = { "BufReadPre", "BufNewFile" },
	dependencies = {
		{ "antosha417/nvim-lsp-file-operations", config = true }, -- include lsp configs for file rename, etc.
		{ "folke/lazydev.nvim", opts = {} }, -- fix errors when configuring nvim configs. e.g. vim global error
	},
	config = function()
		vim.lsp.config("*", {
			capabilities = require("cmp_nvim_lsp").default_capabilities(),
		})
	end,
}
