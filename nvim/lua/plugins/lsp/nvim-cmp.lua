return {
	"hrsh7th/cmp-nvim-lsp",
	event = { "BufReadPre", "BufNewFile" },
	dependencies = {
		{ "antosha417/nvim-lsp-file-operations", config = true }, -- include lsp configs for file rename, etc.
		{ "folke/lazydev.nvim", ft = "lua", opts = {} }, -- fix errors when configuring nvim configs. e.g. vim global error
	},
}
