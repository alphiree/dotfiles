local keymap = vim.keymap

-- Oil
keymap.set("n", "-", "<cmd>Oil<CR>", { desc = "Open parent directory" })
keymap.set("n", "<C-Bslash>", function()
	vim.cmd("vsplit | wincmd l")
	require("oil").open()
end, { desc = "Open Oil in vertical split" })

keymap.set("n", "<leader>ee", "<cmd>Oil<CR>", { desc = "Open file explorer" })
keymap.set("n", "<leader>ef", function()
	require("oil").open_float()
end, { desc = "Open floating file explorer" })

-- Buffer delete
keymap.set("n", "<leader>x", "<cmd>bdelete<CR>", { desc = "Delete current buffer" })

-- Tooling
keymap.set("n", "<leader>mm", "<cmd>Mason<CR>", { desc = "Mason package manager" })

-- Telescope
keymap.set(
	"n",
	"<leader>ff",
	"<cmd>Telescope find_files sort_last_used=true sort_mru=true theme=ivy<cr>",
	{ desc = "Find files" }
)
keymap.set(
	"n",
	"<leader>fg",
	"<cmd>Telescope git_status sort_last_used=true sort_mru=true initial_mode=normal theme=ivy<cr>",
	{ desc = "Git status" }
)
keymap.set(
	"n",
	"<leader>fb",
	"<cmd>Telescope buffers sort_last_used=true sort_mru=true initial_mode=normal theme=ivy<cr>",
	{ desc = "Open buffers" }
)
keymap.set(
	"n",
	"<leader>fp",
	"<cmd>Telescope lsp_document_symbols initial_mode=normal theme=ivy ignore_symbols=variable,constant<cr>",
	{ desc = "Document symbols" }
)
keymap.set("n", "<leader>fh", "<cmd>Telescope help_tags<cr>", { desc = "Help tags" })
keymap.set("n", "<leader>fr", "<cmd>Telescope oldfiles<cr>", { desc = "Recent files" })
keymap.set("n", "<leader>fs", "<cmd>Telescope live_grep<cr>", { desc = "Find string in cwd" })
keymap.set("n", "<leader>fc", "<cmd>Telescope grep_string<cr>", { desc = "Find word under cursor" })

-- Git
keymap.set("n", "<leader>gp", "<cmd>Gitsigns preview_hunk<cr>", { desc = "Preview hunk" })
keymap.set("n", "<leader>gr", "<cmd>Gitsigns reset_hunk<cr>", { desc = "Reset hunk" })
keymap.set("n", "<leader>ga", function()
	vim.cmd("Gitsigns stage_hunk")
	print("Hunk staged!")
end, { desc = "Stage hunk" })
keymap.set("n", "<leader>gn", "<cmd>Gitsigns next_hunk<cr>", { desc = "Next hunk" })
keymap.set("n", "<leader>gN", "<cmd>Gitsigns prev_hunk<cr>", { desc = "Previous hunk" })
keymap.set("n", "<leader>gb", "<cmd>Gitsigns blame_line<cr>", { desc = "Git blame line" })
keymap.set("n", "<leader>gd", "<cmd>Gitsigns diffthis<cr>", { desc = "Git diff current file" })
