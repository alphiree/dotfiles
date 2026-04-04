local keymap = vim.keymap

-- Window management
keymap.set("n", "<leader>ww", "<C-w>v", { desc = "Split window vertically" })
keymap.set("n", "<leader>ws", "<C-w>s", { desc = "Split window horizontally" })
keymap.set("n", "<leader>we", "<C-w>=", { desc = "Make splits equal size" })
keymap.set("n", "<leader>wq", "<cmd>close<CR>", { desc = "Close current split" })
keymap.set("n", "<leader>wm", "<cmd>MaximizerToggle<CR>", { desc = "Maximize the window" })

-- Tmux window navigation
keymap.set("n", "<C-h>", "<cmd>TmuxNavigateLeft<CR>", { desc = "Window switch to left" })
keymap.set("n", "<C-l>", "<cmd>TmuxNavigateRight<CR>", { desc = "Window switch to right" })
keymap.set("n", "<C-k>", "<cmd>TmuxNavigateUp<CR>", { desc = "Window switch to up" })
keymap.set("n", "<C-j>", "<cmd>TmuxNavigateDown<CR>", { desc = "Window switch to down" })

-- Buffer management
keymap.set("n", "<Tab>", "<C-^>", { desc = "Go to previous buffer" })
