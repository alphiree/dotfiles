local keymap = vim.keymap
local severity = vim.diagnostic.severity

local function enable_native_completion(client, bufnr)
	if client:supports_method("textDocument/completion") then
		vim.lsp.completion.enable(true, client.id, bufnr, {
			autotrigger = true,
		})
	end
end

local function setup_completion_keymaps(bufnr)
	local opts = { buffer = bufnr, expr = true, silent = true }

	keymap.set("i", "<C-j>", function()
		return vim.fn.pumvisible() == 1 and "<C-n>" or "<C-j>"
	end, opts)

	keymap.set("i", "<C-k>", function()
		return vim.fn.pumvisible() == 1 and "<C-p>" or "<C-k>"
	end, opts)

	keymap.set("i", "<C-f>", function()
		return vim.fn.pumvisible() == 1 and "<PageDown>" or "<C-f>"
	end, opts)

	keymap.set("i", "<C-b>", function()
		return vim.fn.pumvisible() == 1 and "<PageUp>" or "<C-b>"
	end, opts)

	keymap.set("i", "<C-Space>", function()
		vim.lsp.completion.get()
		return ""
	end, opts)

	keymap.set({ "i", "s" }, "<Tab>", function()
		if vim.fn.pumvisible() == 1 then
			return "<C-y>"
		end
		if vim.snippet.active({ direction = 1 }) then
			return "<Cmd>lua vim.snippet.jump(1)<CR>"
		end
		return "<Tab>"
	end, opts)

	keymap.set({ "i", "s" }, "<S-Tab>", function()
		if vim.fn.pumvisible() == 1 then
			return "<C-p>"
		end
		if vim.snippet.active({ direction = -1 }) then
			return "<Cmd>lua vim.snippet.jump(-1)<CR>"
		end
		return "<S-Tab>"
	end, opts)
end

local function parse_signature_params(word, def_text)
	local escaped = vim.pesc(word)

	return def_text:match("def%s+" .. escaped .. "%s*%((.-)%)%s*%-?%>?")
		or def_text:match("func%s+%(?[^)]*%)?%s*" .. escaped .. "%s*%((.-)%)")
		or def_text:match("function%s+" .. escaped .. "%s*%((.-)%)")
		or def_text:match(escaped .. "%s*=%s*%(?%((.-)%)")
end

local function expand_signature_with_named_params()
	local line, col = unpack(vim.api.nvim_win_get_cursor(0))
	local current_line = vim.api.nvim_get_current_line()

	local start_col = col
	while start_col > 0 do
		local char = current_line:sub(start_col, start_col)
		if not char:match("[%w_.]") then
			break
		end
		start_col = start_col - 1
	end
	start_col = start_col + 1

	local end_col = col + 1
	while end_col <= #current_line do
		local char = current_line:sub(end_col, end_col)
		if not char:match("[%w_.]") then
			break
		end
		end_col = end_col + 1
	end
	end_col = end_col - 1

	local full_expr = current_line:sub(start_col, end_col)
	local word = full_expr:match("([%w_]+)$") or full_expr
	if word == "" then
		vim.notify("No word under cursor", vim.log.levels.INFO)
		return
	end

	local clients = vim.lsp.get_clients({ bufnr = 0 })
	if #clients == 0 then
		vim.notify("No LSP client attached", vim.log.levels.INFO)
		return
	end

	local client = clients[1]
	local params = vim.lsp.util.make_position_params(0, client.offset_encoding or "utf-16")

	vim.lsp.buf_request(0, "textDocument/definition", params, function(err, result)
		if err or not result or vim.tbl_isempty(result) then
			vim.notify("Could not find definition for: " .. word, vim.log.levels.WARN)
			return
		end

		local definition = result[1] or result
		local def_uri = definition.targetUri or definition.uri
		local def_range = definition.targetRange or definition.range
		if not def_uri or not def_range then
			vim.notify("Invalid definition result for: " .. word, vim.log.levels.WARN)
			return
		end

		local def_bufnr = vim.uri_to_bufnr(def_uri)
		vim.fn.bufload(def_bufnr)
		local def_lines = vim.api.nvim_buf_get_lines(def_bufnr, def_range.start.line, def_range.start.line + 20, false)
		local params_str = parse_signature_params(word, table.concat(def_lines, "\n"))
		if not params_str then
			vim.notify("Could not parse function signature for: " .. word, vim.log.levels.WARN)
			return
		end

		local snippet_lines = { full_expr .. "(" }
		local index = 1
		for param in params_str:gmatch("[^,]+") do
			param = param:match("^%s*(.-)%s*$")
			local param_name = param:match("^([%w_]+)") or param
			if not vim.tbl_contains({ "self", "cls", "context", "" }, param_name) then
				table.insert(snippet_lines, "\t" .. param_name .. "=${" .. index .. "},")
				index = index + 1
			end
		end
		table.insert(snippet_lines, ")$0")

		vim.api.nvim_buf_set_text(0, line - 1, start_col - 1, line - 1, end_col, {})
		vim.api.nvim_win_set_cursor(0, { line, start_col - 1 })
		vim.cmd("startinsert")
		vim.schedule(function()
			vim.snippet.expand(table.concat(snippet_lines, "\n"))
		end)
	end)
end

vim.api.nvim_create_autocmd("LspAttach", {
	group = vim.api.nvim_create_augroup("UserLspConfig", { clear = true }),
	callback = function(ev)
		local client = assert(vim.lsp.get_client_by_id(ev.data.client_id))
		local opts = { buffer = ev.buf, silent = true }

		enable_native_completion(client, ev.buf)
		setup_completion_keymaps(ev.buf)

		opts.desc = "Show LSP references"
		keymap.set("n", "gR", "<cmd>Telescope lsp_references<CR>", opts)

		opts.desc = "Go to declaration"
		keymap.set("n", "gD", vim.lsp.buf.declaration, opts)

		opts.desc = "Show LSP definition"
		keymap.set("n", "gd", vim.lsp.buf.definition, opts)

		opts.desc = "Show LSP implementations"
		keymap.set("n", "gi", "<cmd>Telescope lsp_implementations<CR>", opts)

		opts.desc = "Show LSP type definitions"
		keymap.set("n", "gt", "<cmd>Telescope lsp_type_definitions<CR>", opts)

		opts.desc = "See available code actions"
		keymap.set({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, opts)

		opts.desc = "Smart rename"
		keymap.set("n", "<leader>rn", vim.lsp.buf.rename, opts)

		opts.desc = "Show buffer diagnostics"
		keymap.set("n", "<leader>D", "<cmd>Telescope diagnostics bufnr=0<CR>", opts)

		opts.desc = "Show line diagnostics"
		keymap.set("n", "<leader>d", vim.diagnostic.open_float, opts)

		opts.desc = "Go to previous diagnostic"
		keymap.set("n", "[d", function()
			vim.diagnostic.jump({ count = -1, float = true })
		end, opts)

		opts.desc = "Go to next diagnostic"
		keymap.set("n", "]d", function()
			vim.diagnostic.jump({ count = 1, float = true })
		end, opts)

		opts.desc = "Show documentation for what is under cursor"
		keymap.set("n", "K", vim.lsp.buf.hover, opts)

		opts.desc = "Restart LSP"
		keymap.set("n", "<leader>rs", "<cmd>lsp restart<CR>", opts)

		opts.desc = "Expand function signature with named parameters"
		keymap.set("n", "<leader>cc", expand_signature_with_named_params, opts)
	end,
})

vim.diagnostic.config({
	virtual_lines = false,
	virtual_text = false,
	float = { source = true },
	signs = {
		text = {
			[severity.ERROR] = " ",
			[severity.WARN] = " ",
			[severity.HINT] = "󰠠 ",
			[severity.INFO] = " ",
		},
	},
})
