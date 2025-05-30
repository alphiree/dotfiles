-- set leader key to space
vim.g.mapleader = " "

local keymap = vim.keymap -- for conciseness

-- General Keymaps -------------------

-- use jk instead of ESC to exit insert mode
-- keymap.set("i", "jk", "<ESC>", { desc = "Exit insert mode with jk" })

-- map q exit to ctrl+q
keymap.set("n", "<leader>q", "<cmd>q<CR>", { desc = "Exit nvim" })

-- clear search highlights
keymap.set("n", "<leader>nh", ":nohl<CR>", { desc = "Clear search highlights" })
--  See `:help hlsearch`
keymap.set("n", "<Esc>", "<cmd>nohlsearch<CR>")

-- setting Ctrl+S to save file
-- -- Normal mode mapping
-- keymap.set("n", "<C-S>", ":update<CR>", { silent = true })
-- -- Visual mode mapping
-- keymap.set("v", "<C-S>", "<C-C>:update<CR>", { silent = true })
-- -- Insert mode mapping
-- keymap.set("i", "<C-S>", "<C-O>:update<CR><C-\\><C-n>", { silent = true })

-- setting zz to save file
-- Normal mode mapping
keymap.set("n", "zz", ":update<CR>", { silent = true })
-- Visual mode mapping
keymap.set("v", "zz", "<C-C>:update<CR>", { silent = true })
-- -- Insert mode mapping
-- keymap.set("i", "zz", "<C-O>:update<CR><C-\\><C-n>", { silent = true })

-- fold all inside the current file
keymap.set("n", "<leader>k", "zM", {})
-- unfold all inside the current file
keymap.set("n", "<leader>j", "zR", {})

-- delete single character without copying into register
keymap.set("n", "x", '"_x')

-- move lines up and down
keymap.set("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move line down" })
keymap.set("v", "K", ":m '>-2<CR>gv=gv", { desc = "Move line up" })

-- paste without replacing the current selection
-- keymap.set("x", "<leader>p", '"_dP')
keymap.set("x", "p", '"_dP')

-- copy to system clipboard
keymap.set("v", "<leader>y", '"+y')

-- when deleting it won't copy to clipboard
keymap.set("n", "d", '"_d')
keymap.set("n", "dd", '"_dd')
keymap.set("n", "diw", '"_diw')

-- use ctrl+f as find when in current file
keymap.set("n", "<c-f>", "/", { desc = "Open tmux sessionizer" })

-- replace all instances of a word im in, in the current file
keymap.set("n", "<leader>s", [[:%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>]])

-- keep cursor in the middle of the screen when scrolling
keymap.set("n", "<C-d>", "<C-d>zz")
keymap.set("n", "<C-u>", "<C-u>zz")

-- keeps the searched text in the middle of the screen
keymap.set("n", "n", "nzzzv")
keymap.set("n", "N", "Nzzzv")

-- oil nvim navigation
keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "Open parent directory" })
-- open oil in vertical split
keymap.set("n", "<C-Bslash>", function()
	vim.cmd("vsplit | wincmd l")
	require("oil").open()
end)

-- Refreshes the current buffer
keymap.set("n", "<leader>br", function()
	-- Reloads the file to reflect the changes
	vim.cmd("edit!")
	print("Buffer reloaded")
end, { desc = "[P]Reload current buffer" })

-- To stop the LSP server
keymap.set("n", "<leader>S", "<cmd>LspStop<CR>", { desc = "LspStop" })

-- get the current path of the buffer i'm currently in and add it to clipboard
keymap.set("n", "<leader>cp", function()
	vim.fn.setreg("+", vim.fn.expand("%:p"))
	print("Path copied to clipboard")
end, { desc = "Copy current path to clipboard" })

-- creates a new file inside the directory of the buffer you are in
function OpenNewFile(filename)
	vim.cmd("edit %:h/" .. filename)
end
vim.api.nvim_set_keymap(
	"n",
	"<Leader>nf",
	':lua OpenNewFile(vim.fn.input("Enter filename: "))<CR>',
	{ noremap = true, silent = true }
)

-- increment/decrement numbers
keymap.set("n", "<leader>+", "<C-a>", { desc = "Increment number" }) -- increment
keymap.set("n", "<leader>-", "<C-x>", { desc = "Decrement number" }) -- decrement

-- window management
keymap.set("n", "<leader>ww", "<C-w>v", { desc = "Split window vertically" }) -- split window horizontally
keymap.set("n", "<leader>ws", "<C-w>s", { desc = "Split window horizontally" }) -- split window vertically
-- keymap.set("n", "<leader>wh", "<C-w>>", { desc = "Resize Window to the Left" })
-- keymap.set("n", "<leader>wh", "<C-w><", { desc = "Resize Window to the Left" })
keymap.set("n", "<leader>we", "<C-w>=", { desc = "Make splits equal size" }) -- make split windows equal width & height
keymap.set("n", "<leader>wq", "<cmd>close<CR>", { desc = "Close current split" }) -- close current split window
keymap.set("n", "<leader>wm", "<cmd>MaximizerToggle<CR>", { desc = "Maximize the Window" })
-- switching windows
keymap.set("n", "<C-l>", "<cmd>TmuxNavigateLeft<CR>", { desc = "Window switch to left" })
keymap.set("n", "<C-h>", "<cmd>TmuxNavigateRight<CR>", { desc = "Window switch to right" })
keymap.set("n", "<C-k>", "<cmd>TmuxNavigateUp<CR>", { desc = "Window switch to up" })
keymap.set("n", "<C-j>", "<cmd>TmuxNavigateDown<CR>", { desc = "Window switch to down" })

-- tab management
-- keymap.set("n", "<leader>tt", "<cmd>tabnew<CR>", { desc = "Open new tab" }) -- open new tab
-- keymap.set("n", "<leader>tg", "<cmd>tabclose<CR>", { desc = "Close current tab" }) -- close current tab
-- keymap.set("n", "<leader>ty", "<cmd>tabn<CR>", { desc = "Go to next tab" }) --  go to next tab
-- keymap.set("n", "<leader>tr", "<cmd>tabp<CR>", { desc = "Go to previous tab" }) --  go to previous tab
-- keymap.set("n", "<leader>tf", "<cmd>tabnew %<CR>", { desc = "Open current buffer in new tab" }) --  move current buffer to new tab

-- buffer management
-- keymap.set("n", "<Tab>", ":bnext<CR>", { desc = "Go to next buffer" })
-- keymap.set("n", "<S-Tab>", ":bprev<CR>", { desc = "Go to previous buffer" })
keymap.set("n", "<Tab>", "<C-^>", { desc = "Go to next buffer" })
keymap.set("n", "<leader>x", ":Bdelete<CR>", { desc = "Remove Current Buffer" })

-- PLUGINS

-- Lazy Plugin Popup
keymap.set("n", "<leader>ll", "<cmd>Lazy<CR>", { desc = "Lazy Plugin Manager Popup" })

-- Mason LSP Manager Popup
keymap.set("n", "<leader>mm", "<cmd>Mason<CR>", { desc = "Mason LSP Manager Popup" })

-- nvim tree (file explorer)
keymap.set("n", "<leader>ee", "<cmd>NvimTreeToggle<CR>", { desc = "Toggle file explorer" })
keymap.set("n", "<leader>ef", "<cmd>NvimTreeFocus<CR>", { desc = "Focus to file explorer" })

--   keymap.set("n", "<leader>er", "<cmd>NvimTreeRefresh<CR>", { desc = "Refresh file explorer" }) -- refresh file explorer

-- Telescope
keymap.set("n", "<leader>ff", "<cmd>Telescope find_files<cr>", {})
keymap.set(
	"n",
	"<leader>ff",
	"<cmd>Telescope find_files sort_last_used=true sort_mru=true theme=ivy<cr>",
	{ desc = "Open file" }
)
keymap.set(
	"n",
	"<leader>fg",
	"<cmd>Telescope git_status sort_last_used=true sort_mru=true initial_mode=normal theme=ivy<cr>",
	{ desc = "Open buffers" }
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
	{ desc = "Open file" }
)
keymap.set("n", "<leader>fh", "<cmd>Telescope help_tags<cr>", {})
keymap.set("n", "<leader>fr", "<cmd>Telescope oldfiles<cr>", { desc = "Fuzzy find recent files" })
keymap.set("n", "<leader>fs", "<cmd>Telescope live_grep<cr>", { desc = "Find string in cwd" })
keymap.set("n", "<leader>fc", "<cmd>Telescope grep_string<cr>", { desc = "Find string under cursor in cwd" })

-- Gitsigns
keymap.set("n", "<leader>gp", "<cmd>Gitsigns preview_hunk<cr>", {})
-- Gitsigns: reset hunk
keymap.set("n", "<leader>gr", "<cmd>Gitsigns reset_hunk<cr>", {})
-- Gitsigns: Stage/Add hunk
-- keymap.set("n", "<leader>ga", "<cmd>Gitsigns stage_hunk<cr>", { desc = "Stage hunk!" })

keymap.set("n", "<leader>ga", function()
	-- Reloads the file to reflect the changes
	vim.cmd("Gitsigns stage_hunk")
	print("Hunk staged!")
end, { desc = "Stage Hunk" })
-- Gitsigns: previous/next hunk
keymap.set("n", "<leader>gn", "<cmd>Gitsigns next_hunk<cr>", {})
keymap.set("n", "<leader>gN", "<cmd>Gitsigns prev_hunk<cr>", {})
-- Gitblame
keymap.set("n", "<leader>gb", "<cmd>Git blame<cr>", {})
-- Gitdiff with current file
keymap.set("n", "<leader>gd", "<cmd>Gdiffsplit<cr>", {})
-- Lazygit integration
keymap.set("n", "<leader>gg", "<cmd>LazyGit<cr>", {})
