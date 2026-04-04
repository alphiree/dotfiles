return {
	"neovim/nvim-lspconfig",
	event = { "BufReadPre", "BufNewFile" },
	config = function()
		local capabilities = vim.lsp.protocol.make_client_capabilities()
		local has_cmp, cmp_nvim_lsp = pcall(require, "cmp_nvim_lsp")
		if has_cmp then
			capabilities = cmp_nvim_lsp.default_capabilities(capabilities)
		end

		local servers = {
			basedpyright = {},
			gopls = {},
			lua_ls = {
				settings = {
					Lua = {
						diagnostics = {
							globals = { "vim" },
						},
						workspace = {
							checkThirdParty = false,
						},
					},
				},
			},
			marksman = {},
			prismals = {},
			ruff = {},
			sqlls = {},
			tailwindcss = {},
		}

		for server, opts in pairs(servers) do
			opts.capabilities = vim.tbl_deep_extend("force", {}, capabilities, opts.capabilities or {})
			vim.lsp.config(server, opts)
			vim.lsp.enable(server)
		end
	end,
}
