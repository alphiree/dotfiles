local M = {}

function M.setup()
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
			["<CR>"] = "actions.select",
			["<C-t>"] = { "actions.select", opts = { tab = true } },
			["<Bslash>"] = "actions.preview",
			["<C-c>"] = { "actions.close", mode = "n" },
			["-"] = { "actions.parent", mode = "n" },
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
