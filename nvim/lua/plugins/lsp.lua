local M = {}

local servers = {
	basedpyright = {},
	gopls = {},
	lua_ls = {
		settings = {
			Lua = {
				runtime = { version = "LuaJIT" },
				diagnostics = { globals = { "vim" } },
				workspace = {
					checkThirdParty = false,
					library = vim.api.nvim_get_runtime_file("", true),
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

local tools = {
	"stylua",
	"prettier",
	"sqlfluff",
}

local function server_names()
	local names = vim.tbl_keys(servers)
	table.sort(names)
	return names
end

local function make_capabilities()
	local capabilities = vim.lsp.protocol.make_client_capabilities()
	local completion = capabilities.textDocument.completion
	local item = completion.completionItem

	item.snippetSupport = true
	item.commitCharactersSupport = true
	item.deprecatedSupport = true
	item.preselectSupport = true
	item.tagSupport = { valueSet = { 1 } }
	item.insertReplaceSupport = true
	item.resolveSupport = {
		properties = {
			"documentation",
			"additionalTextEdits",
			"insertTextFormat",
			"insertTextMode",
			"command",
		},
	}
	item.insertTextModeSupport = { valueSet = { 1, 2 } }
	item.labelDetailsSupport = true
	completion.contextSupport = true
	completion.insertTextMode = 1
	completion.completionList = {
		itemDefaults = {
			"commitCharacters",
			"editRange",
			"insertTextFormat",
			"insertTextMode",
			"data",
		},
	}

	return capabilities
end

local function setup_mason()
	require("mason").setup({
		ui = {
			icons = {
				package_installed = "✓",
				package_pending = "➜",
				package_uninstalled = "✗",
			},
		},
	})

	require("mason-lspconfig").setup({
		ensure_installed = server_names(),
		automatic_enable = false,
	})

	require("mason-tool-installer").setup({
		ensure_installed = tools,
		auto_update = false,
		run_on_start = true,
	})
end

local function setup_servers()
	vim.lsp.config("*", {
		capabilities = make_capabilities(),
	})

	for server, opts in pairs(servers) do
		vim.lsp.config(server, opts)
		vim.lsp.enable(server)
	end
end

local function setup_formatting()
	local conform = require("conform")

	conform.setup({
		formatters_by_ft = {
			javascript = { "prettier" },
			typescript = { "prettier" },
			javascriptreact = { "prettier" },
			typescriptreact = { "prettier" },
			css = { "prettier" },
			html = { "prettier" },
			json = { "prettier" },
			yaml = { "prettier" },
			markdown = { "prettier" },
			graphql = { "prettier" },
			lua = { "stylua" },
			python = {
				"ruff_format",
				"ruff_organize_imports",
			},
		},
		format_on_save = {
			lsp_format = "fallback",
			async = false,
			timeout_ms = 1000,
		},
	})

	vim.keymap.set({ "n", "v" }, "<leader>mp", function()
		conform.format({
			lsp_format = "fallback",
			async = false,
			timeout_ms = 500,
		})
		print("Applied formatting!")
	end, { desc = "Format file or range (in visual mode)" })
end

local function setup_linting()
	local lint = require("lint")

	lint.linters_by_ft = {
		sql = { "sqlfluff" },
	}

	vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave" }, {
		group = vim.api.nvim_create_augroup("UserLint", { clear = true }),
		callback = function()
			lint.try_lint()
		end,
	})
end

function M.setup()
	setup_mason()
	setup_servers()
	setup_formatting()
	setup_linting()
end

return M
