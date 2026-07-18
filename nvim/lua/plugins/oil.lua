local M = {}

function M.setup()
	local logical_parents = {}

	local function normalize_path(path)
		path = vim.fn.fnamemodify(path, ":p")
		path = vim.fn.resolve(path)
		path = vim.fn.fnamemodify(path, ":p")
		return path
	end

	local function logical_parent()
		local oil = require("oil")
		local current_dir = oil.get_current_dir()
		if not current_dir then
			return require("oil.actions").parent.callback()
		end

		local parent = logical_parents[normalize_path(current_dir)]
		if parent then
			oil.open(parent)
		else
			require("oil.actions").parent.callback()
		end
	end

	local function logical_select(opts)
		opts = opts or {}
		local oil = require("oil")
		local entry = oil.get_cursor_entry()

		if entry and entry.name == ".." then
			return logical_parent()
		end

		local current_dir = oil.get_current_dir()
		if
			entry
			and current_dir
			and entry.type == "link"
			and entry.meta
			and entry.meta.link_stat
		then
			-- Oil normalizes links before opening them. Remember the logical
			-- parent for both linked directories and linked files so `-` can
			-- navigate back to the path the link was selected from.
			logical_parents[normalize_path(current_dir .. entry.name)] = current_dir
		end

		oil.select(opts)
	end

	function M.open_parent()
		local oil = require("oil")
		local bufname = vim.api.nvim_buf_get_name(0)
		if vim.bo.filetype ~= "oil" and bufname ~= "" and not bufname:match("^[^/]+://") then
			local parent = logical_parents[normalize_path(bufname)]
			if parent then
				return oil.open(parent)
			end
		end

		oil.open()
	end

	require("oil").setup({
		default_file_explorer = true,
		columns = { "icon" },
		delete_to_trash = true,
		skip_confirm_for_simple_edits = true,
		prompt_save_on_select_new_entry = true,
		lsp_file_methods = {
			enabled = true,
			timeout_ms = 1000,
			autosave_changes = false,
		},
		constrain_cursor = "editable",
		keymaps = {
			["g?"] = { "actions.show_help", mode = "n" },
			["<CR>"] = { callback = logical_select, desc = "Select entry" },
			["<C-t>"] = {
				callback = function()
					logical_select({ tab = true })
				end,
				desc = "Select entry in new tab",
			},
			["<Bslash>"] = "actions.preview",
			["<C-c>"] = { "actions.close", mode = "n" },
			["-"] = { callback = logical_parent, desc = "Open parent directory", mode = "n" },
			["_"] = { "actions.open_cwd", mode = "n" },
			["`"] = { "actions.cd", mode = "n" },
			["~"] = { "actions.cd", opts = { scope = "tab" }, mode = "n" },
			["gs"] = { "actions.change_sort", mode = "n" },
			["gx"] = "actions.open_external",
			["g."] = { "actions.toggle_hidden", mode = "n" },
			["g\\"] = { "actions.toggle_trash", mode = "n" },
		},
		use_default_keymaps = false,
		view_options = {
			show_hidden = true,
			natural_order = "fast",
			sort = {
				{ "type", "asc" },
				{ "name", "asc" },
			},
		},
		float = { border = "rounded" },
		confirmation = { border = "rounded" },
		progress = { border = "rounded" },
		ssh = { border = "rounded" },
		keymaps_help = { border = "rounded" },
	})

	if vim.fn.argc() == 0 then
		vim.cmd("Oil")
	end
end

return M
