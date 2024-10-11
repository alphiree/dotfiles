return {
	"epwalsh/obsidian.nvim",
	version = "*", -- recommended, use latest release instead of latest commit
	lazy = false,
	ft = "markdown",
	-- Replace the above line with this if you only want to load obsidian.nvim for markdown files in your vault:
	-- event = {
	--   -- If you want to use the home shortcut '~' here you need to call 'vim.fn.expand'.
	--   -- E.g. "BufReadPre " .. vim.fn.expand "~" .. "/my-vault/*.md"
	--   -- refer to `:h file-pattern` for more examples
	--   "BufReadPre path/to/my-vault/*.md",
	--   "BufNewFile path/to/my-vault/*.md",
	-- },
	dependencies = {
		-- Required.
		"nvim-lua/plenary.nvim",
	},
	opts = {
		workspaces = {
			{
				name = "personal",
				path = "~/Desktop/projects/obsidian/",
				overrides = {
					notes_subdir = "1 - Notes",
				},
			},
		},
		new_notes_location = "notes_subdir",
		ui = {
			enable = false, -- set to false to disable all additional syntax features
		},
		daily_notes = {
			-- Optional, if you keep daily notes in a separate directory.
			folder = "2 - Daily",
			-- Optional, if you want to change the date format for the ID of daily notes.
			date_format = "%Y-%m-%d",
			-- Optional, if you want to change the date format of the default alias of daily notes.
			alias_format = "%B %-d, %Y",
			-- Optional, default tags to add to each new daily note created.
			default_tags = { "daily-notes" },
			-- Optional, if you want to automatically insert a template from your template directory like 'daily.md'
			template = "Daily_2024.md",
		},
		templates = {
			folder = "4 - Templates",
			-- date_format = "%Y-%m-%d",
			-- time_format = "%H:%M",
			-- A map for custom variables, the key should be the variable and the value a function
			-- substitutions = {},
		},
		attachments = {
			img_folder = "9 - Attachments",
		},
	},
}
