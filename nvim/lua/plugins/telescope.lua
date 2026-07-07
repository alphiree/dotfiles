local M = {}

function M.setup()
	local actions = require("telescope.actions")
	local action_state = require("telescope.actions.state")

	require("telescope").setup({
		defaults = {
			mappings = {
				i = {
					["<C-h>"] = "which_key",
				},
				n = {
					["d"] = actions.delete_buffer,
					["<C-b>"] = function(prompt_bufnr)
						local picker = action_state.get_current_picker(prompt_bufnr)
						for _, entry in ipairs(picker:get_multi_selection()) do
							vim.cmd("badd " .. entry.value)
						end
						print("Selected files have been opened in buffers.")
					end,
				},
			},
		},
		pickers = {
			find_files = {
				file_ignore_patterns = {
					".git/.*",
					".cache",
					".venv/.*",
					"venv/.*",
				},
				find_command = {
					"fd",
					"--type",
					"f",
					"--color=never",
					"--no-ignore-vcs",
					"--hidden",
					"--follow",
				},
			},
		},
	})
end

return M
