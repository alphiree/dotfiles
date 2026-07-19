local keymap = vim.keymap

-- We provide our own Ctrl+h/j/k/l mappings below so they can choose between
-- Herdr-aware navigation and vim-tmux-navigator. Prevent vim-tmux-navigator
-- from overwriting these mappings when the plugin loads later.
vim.g.tmux_navigator_no_mappings = 1

-- Window management
keymap.set("n", "<leader>ww", "<C-w>v", { desc = "Split window vertically" })
keymap.set("n", "<leader>ws", "<C-w>s", { desc = "Split window horizontally" })
keymap.set("n", "<leader>we", "<C-w>=", { desc = "Make splits equal size" })
keymap.set("n", "<leader>wq", "<cmd>close<CR>", { desc = "Close current split" })
keymap.set("n", "<leader>wm", "<cmd>MaximizerToggle<CR>", { desc = "Maximize the window" })

-- Seamless window/pane navigation.
-- - Inside Herdr: move between Neovim splits first; at an edge, focus a Herdr pane.
-- - Outside Herdr: keep the existing vim-tmux-navigator behavior.
local function navigate_window(vim_direction, herdr_direction, tmux_command)
	if vim.env.HERDR_PANE_ID and vim.fn.executable("herdr") == 1 then
		local current_win = vim.api.nvim_get_current_win()
		vim.cmd("wincmd " .. vim_direction)

		if vim.api.nvim_get_current_win() == current_win then
			vim.fn.jobstart({
				"herdr",
				"pane",
				"focus",
				"--direction",
				herdr_direction,
				"--pane",
				vim.env.HERDR_PANE_ID,
			}, { detach = true })
		end

		return
	end

	vim.cmd(tmux_command)
end

keymap.set("n", "<C-h>", function()
	navigate_window("h", "left", "TmuxNavigateLeft")
end, { desc = "Window switch to left" })
keymap.set("n", "<C-l>", function()
	navigate_window("l", "right", "TmuxNavigateRight")
end, { desc = "Window switch to right" })
keymap.set("n", "<C-k>", function()
	navigate_window("k", "up", "TmuxNavigateUp")
end, { desc = "Window switch to up" })
keymap.set("n", "<C-j>", function()
	navigate_window("j", "down", "TmuxNavigateDown")
end, { desc = "Window switch to down" })

-- Buffer management
keymap.set("n", "<Tab>", "<C-^>", { desc = "Go to previous buffer" })
