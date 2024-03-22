-- set leader key to space
vim.g.mapleader = " "

local keymap = vim.keymap -- for conciseness

-- General Keymaps -------------------

-- use jk instead of ESC to exit insert mode
keymap.set("i", "jk", "<ESC>", { desc = "Exit insert mode with jk" })

-- map q! exit to ctrl+q
keymap.set("n", "<C-q>", "<cmd>q<CR>", { desc = "Exit insert mode with jk" })

-- clear search highlights
keymap.set("n", "<leader>nh", ":nohl<CR>", { desc = "Clear search highlights" })

-- setting Ctrl+S to save file
-- Normal mode mapping
keymap.set("n", "<C-S>", ":update<CR>", { silent = true })
-- Visual mode mapping
keymap.set("v", "<C-S>", "<C-C>:update<CR>", { silent = true })
-- Insert mode mapping
keymap.set("i", "<C-S>", "<C-O>:update<CR><C-\\><C-n>", { silent = true })

-- delete single character without copying into register
keymap.set("n", "x", '"_x')

-- scroll down with cursor on same line mapping
-- Scroll Down
keymap.set("n", "<A-down>", "<C-e>")
-- Scroll Up
keymap.set("n", "<A-up>", "<C-y>")

-- increment/decrement numbers
keymap.set("n", "<leader>+", "<C-a>", { desc = "Increment number" }) -- increment
keymap.set("n", "<leader>-", "<C-x>", { desc = "Decrement number" }) -- decrement

-- window management
keymap.set("n", "<leader>ww", "<C-w>v", { desc = "Split window vertically" }) -- split window horizontally
keymap.set("n", "<leader>ws", "<C-w>s", { desc = "Split window horizontally" }) -- split window vertically
keymap.set("n", "<leader>we", "<C-w>=", { desc = "Make splits equal size" }) -- make split windows equal width & height
keymap.set("n", "<leader>wq", "<cmd>close<CR>", { desc = "Close current split" }) -- close current split window

-- switching windows
-- keymap.set("n", "<M-left>", "<cmd>TmuxNavigateLeft<CR>", { desc = "Window switch to left" })
-- keymap.set("n", "<M-right>", "<cmd>TmuxNavigateRight<CR>", { desc = "Window switch to right" })
-- keymap.set("n", "<M-up>", "<cmd>TmuxNavigateUp<CR>", { desc = "Window switch to up" })
-- keymap.set("n", "<M-down>", "<cmd>TmuxNavigateDown<CR>", { desc = "Window switch to down" })

-- tab management
-- keymap.set("n", "<leader>tt", "<cmd>tabnew<CR>", { desc = "Open new tab" }) -- open new tab
-- keymap.set("n", "<leader>tg", "<cmd>tabclose<CR>", { desc = "Close current tab" }) -- close current tab
-- keymap.set("n", "<leader>ty", "<cmd>tabn<CR>", { desc = "Go to next tab" }) --  go to next tab
-- keymap.set("n", "<leader>tr", "<cmd>tabp<CR>", { desc = "Go to previous tab" }) --  go to previous tab
-- keymap.set("n", "<leader>tf", "<cmd>tabnew %<CR>", { desc = "Open current buffer in new tab" }) --  move current buffer to new tab

-- buffer management
keymap.set("n", "<Tab>", ":BufferLineCycleNext<CR>", { desc = "Go to next buffer" })
keymap.set("n", "<S-Tab>", ":BufferLineCyclePrev<CR>", { desc = "Go to previous buffer" })
keymap.set("n", "<leader>q", ":Bdelete<CR>", { desc = "Remove Current Buffer" })

-- PLUGINS

-- Lazy Plugin Popup
keymap.set("n", "<leader>l", "<cmd>Lazy<CR>", { desc = "Lazy Plugin Manager Popup" })

-- Mason LSP Manager Popup
keymap.set("n", "<leader>mm", "<cmd>Mason<CR>", { desc = "Mason LSP Manager Popup" })

-- nvim tree (file explorer)
keymap.set("n", "<leader>ee", "<cmd>NvimTreeToggle<CR>", { desc = "Toggle file explorer" })
keymap.set("n", "<leader>ef", "<cmd>NvimTreeFocus<CR>", { desc = "Focus to file explorer" })

--   keymap.set("n", "<leader>er", "<cmd>NvimTreeRefresh<CR>", { desc = "Refresh file explorer" }) -- refresh file explorer

-- window maximizer
keymap.set("n", "<leader>wm", "<cmd>MaximizerToggle<CR>", { desc = "Maximize the Window" })

-- Telescope
keymap.set("n", "<leader>ff", "<cmd>Telescope find_files<cr>", {})
keymap.set("n", "<leader>fg", "<cmd>Telescope git_status<cr>", {})
keymap.set("n", "<leader>fb", "<cmd>Telescope buffers<cr>", {})
keymap.set("n", "<leader>fh", "<cmd>Telescope help_tags<cr>", {})
keymap.set("n", "<leader>fr", "<cmd>Telescope oldfiles<cr>", { desc = "Fuzzy find recent files" })
keymap.set("n", "<leader>fs", "<cmd>Telescope live_grep<cr>", { desc = "Find string in cwd" })
keymap.set("n", "<leader>fc", "<cmd>Telescope grep_string<cr>", { desc = "Find string under cursor in cwd" })

-- Gitsigns
keymap.set("n", "<leader>gp", "<cmd>Gitsigns preview_hunk<cr>", {})
-- Gitblame
keymap.set("n", "<leader>gb", "<cmd>Git blame<cr>", {})
-- Lazygit integration
keymap.set("n", "<leader>gg", "<cmd>LazyGit<cr>", {})

-- ToggleTerm
keymap.set("n", "<C-\\>", "<cmd>ToggleTerm<cr>", {})
