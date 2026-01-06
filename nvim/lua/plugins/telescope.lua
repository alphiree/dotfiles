return {
	"nvim-telescope/telescope.nvim",
	tag = "0.1.5",
	-- or                              , branch = '0.1.x',
	dependencies = { "nvim-lua/plenary.nvim" },
	config = function()
		local action_state = require("telescope.actions.state")

		require("telescope").setup({
			defaults = {
				-- Default configuration for telescope goes here:
				-- config_key = value,
				mappings = {
					i = {
						-- map actions.which_key to <C-h> (default: <C-/>)
						-- actions.which_key shows the mappings for your picker,
						-- e.g. git_{create, delete, ...}_branch for the git_branches picker
						["<C-h>"] = "which_key",
					},
					n = {
						["d"] = require("telescope.actions").delete_buffer,
						-- Adds multiple files in the background as buffer
						["<C-b>"] = function(prompt_bufnr)
							local picker = action_state.get_current_picker(prompt_bufnr)
							local multi_selections = picker:get_multi_selection()

							-- Do not close the picker; just open the selected files in the background
							for _, entry in ipairs(multi_selections) do
								vim.cmd("badd " .. entry.value) -- Add the file to the buffer list without switching
							end
							-- Print a confirmation message
							print("Selected files have been opened in buffers.")
						end,
					},
				},
				file_ignore_patterns = {
					".git/.*",
					".cache",
					".venv/.*",
					"venv/.*",
				},
			},
			pickers = {
				find_files = {
					find_command = {
						"fd",
						"--type",
						"f",
						"--color=never",
						-- including the files included in .gitignore. ex: I want to see .env file
						"--no-ignore-vcs",
						"--hidden",
						"--follow",
					},
				},
			},
			extensions = {
				-- Your extension configuration goes here:
				-- extension_name = {
				--   extension_config_key = value,
				-- }
				-- please take a look at the readme of the extension you want to configure
			},
		})
	end,
}
