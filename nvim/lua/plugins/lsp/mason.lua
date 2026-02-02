return {
	"williamboman/mason.nvim",
	dependencies = {
		"williamboman/mason-lspconfig.nvim",
		"WhoIsSethDaniel/mason-tool-installer.nvim",
	},
	config = function()
		local mason = require("mason")
		local mason_lspconfig = require("mason-lspconfig")
		local mason_tool_installer = require("mason-tool-installer")

		-- enable mason and configure icons
		mason.setup({
			ui = {
				icons = {
					package_installed = "✓",
					package_pending = "➜",
					package_uninstalled = "✗",
				},
			},
		})

		mason_lspconfig.setup({
			ensure_installed = {
				"stylua", -- lua lsp and formatter
				"lua_ls",
				"prismals",
				"basedpyright",
				"tailwindcss",
				"gopls",
				"ruff",
				"marksman", -- markdown
				"sqlls", -- adding this so lsp will attach to sql files
			},
			automatic_installation = true,
			auto_update = false,
		})

		mason_tool_installer.setup({
			ensure_installed = { -- tools that cannot be installed in mason_lspconfig
				-- formatters and linters
				"prettier",
				-- "eslint_d", -- js
				"sqlfluff", -- sql
				-- "mypy",
			},
			automatic_installation = true,
			auto_update = false,
		})
	end,
}
