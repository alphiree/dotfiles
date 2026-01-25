return {
	"hrsh7th/nvim-cmp",
	keys = {
		{
			"<leader>cc",
			function()
				local luasnip = require("luasnip")

				-- Get cursor position
				local line, col = unpack(vim.api.nvim_win_get_cursor(0))
				local current_line = vim.api.nvim_get_current_line()

				-- Find the full expression by expanding left and right from cursor
				-- Expand left to find start of expression (including dots)
				local start_col = col
				while start_col > 0 do
					local char = current_line:sub(start_col, start_col)
					if not char:match("[%w_.]") then
						break
					end
					start_col = start_col - 1
				end
				start_col = start_col + 1 -- Move back to the valid character

				-- Expand right to find end of expression (including dots)
				local end_col = col + 1
				while end_col <= #current_line do
					local char = current_line:sub(end_col, end_col)
					if not char:match("[%w_.]") then
						break
					end
					end_col = end_col + 1
				end
				end_col = end_col - 1 -- Move back to the valid character

				-- Extract the full expression
				local full_expr = current_line:sub(start_col, end_col)

				-- Extract just the method/function name (last part after dot)
				local word = full_expr:match("([%w_]+)$") or full_expr

				if word == "" then
					print("No word under cursor")
					return
				end

				-- Get LSP clients
				local clients = vim.lsp.get_clients({ bufnr = 0 })
				if #clients == 0 then
					print("No LSP client attached")
					return
				end

				-- Get the first client's position encoding
				local client = clients[1]
				local position_encoding = client.offset_encoding or "utf-16"

				-- Use textDocument/definition to find the function definition
				local params = vim.lsp.util.make_position_params(0, position_encoding)

				vim.lsp.buf_request(0, "textDocument/definition", params, function(def_err, def_result)
					if def_err or not def_result or vim.tbl_isempty(def_result) then
						print("Could not find definition for: " .. word)
						return
					end

					-- Get the definition location
					local definition = def_result[1] or def_result
					local def_uri = definition.targetUri or definition.uri
					local def_range = definition.targetRange or definition.range

					-- Read the definition file
					local def_bufnr = vim.uri_to_bufnr(def_uri)
					vim.fn.bufload(def_bufnr)
					local def_lines = vim.api.nvim_buf_get_lines(
						def_bufnr,
						def_range.start.line,
						def_range.start.line + 20, -- Read up to 20 lines to capture full signature
						false
					)

					-- Join lines and find the function signature
					local def_text = table.concat(def_lines, "\n")

					-- Match function definition patterns for different languages
					local params_str = nil

					-- Python: def function_name(params):
					params_str = def_text:match("def%s+" .. vim.pesc(word) .. "%s*%((.-)%)%s*%-?%>?")

					-- Go: func function_name(params)
					if not params_str then
						params_str = def_text:match("func%s+%(?[^)]*%)?%s*" .. vim.pesc(word) .. "%s*%((.-)%)")
					end

					-- JavaScript/TypeScript: function function_name(params) or const function_name = (params)
					if not params_str then
						params_str = def_text:match("function%s+" .. vim.pesc(word) .. "%s*%((.-)%)")
							or def_text:match(vim.pesc(word) .. "%s*=%s*%(?%((.-)%)")
					end

					if not params_str then
						print("Could not parse function signature for: " .. word)
						return
					end

					-- Build snippet with named parameters on separate lines
					local snippet_lines = { full_expr .. "(" }
					local param_count = 1

					-- Split parameters and create snippet placeholders
					if params_str ~= "" then
						for param in params_str:gmatch("[^,]+") do
							param = param:match("^%s*(.-)%s*$") -- trim whitespace

							-- Extract just the parameter name (remove type hints, defaults, etc.)
							local param_name = param:match("^([%w_]+)") or param

							-- Skip common skip-worthy parameters
							if
								param_name ~= "self"
								and param_name ~= "cls"
								and param_name ~= "context"
								and param_name ~= ""
							then
								table.insert(snippet_lines, "\t" .. param_name .. "=${" .. param_count .. "},")
								param_count = param_count + 1
							end
						end
					end

					table.insert(snippet_lines, ")$0")
					local snippet_text = table.concat(snippet_lines, "\n")

					-- Delete the full expression (0-indexed for nvim_buf_set_text)
					vim.api.nvim_buf_set_text(0, line - 1, start_col - 1, line - 1, end_col, {})
					vim.api.nvim_win_set_cursor(0, { line, start_col - 1 })

					-- Create autocmd to exit insert mode after snippet expands
					local augroup = vim.api.nvim_create_augroup("SnippetExpandNormalMode", { clear = true })
					vim.api.nvim_create_autocmd("User", {
						pattern = "LuasnipInsertNodeEnter",
						group = augroup,
						once = true,
						callback = function()
							-- Give snippet time to fully render
							vim.defer_fn(function()
								if vim.fn.mode() == "i" then
									vim.cmd("stopinsert")
								end
								-- Clean up the autocmd group
								vim.api.nvim_del_augroup_by_id(augroup)
							end, 10)
						end,
					})

					-- Expand snippet
					vim.cmd("startinsert")
					vim.schedule(function()
						luasnip.lsp_expand(snippet_text)
					end)
				end)
			end,
			mode = "n",
			desc = "Expand function signature with named parameters",
		},
	},
}
