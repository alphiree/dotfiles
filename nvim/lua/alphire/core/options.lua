-- Setting local variable for conciseness
local opt = vim.opt

-- line numbers
opt.relativenumber = true -- show relative line numbers
opt.number = true -- shows absolute line number on cursor line (when relative number is on)

-- tabs & indentation
opt.tabstop = 4 -- spaces for tabs (prettier default)
opt.shiftwidth = 4 -- spaces for indent width
opt.expandtab = true -- expand tab to spaces
opt.autoindent = true -- copy indent from current line when starting new one

-- line wrapping
opt.wrap = false -- disable line wrapping

-- color column on max line
-- opt.colorcolumn = "80"

-- folding code
opt.foldmethod = "indent"
opt.foldlevel = 20 -- set this level to have code not folded automatically

-- search settings
opt.ignorecase = true -- ignore case when searching
opt.smartcase = true -- if you include mixed case in your search, assumes you want case-sensitive

-- appearance
-- turn on termguicolors for nightfly colorscheme to work
-- (have to use iterm2 or any other true color terminal)
opt.termguicolors = true
-- opt.background = "dark" -- colorschemes that can be light or dark will be made dark
-- opt.signcolumn = "yes" -- show sign column so that text doesn't shift

-- backspace
opt.backspace = "indent,eol,start" -- allow backspace on indent, end of line or insert mode start position

-- clipboard
opt.clipboard:append("unnamedplus") -- use system clipboard as default register

-- split windows
opt.splitright = true -- split vertical window to the right
opt.splitbelow = true -- split horizontal window to the bottom

-- divider on windows
-- opt.fillchars = { eob = ' ', fold = ' ', vert = '|', diff = '╱', msgsep = '‾' }
-- vim.cmd('hi VertSplit guifg=#ff0000')

opt.iskeyword:append("-") -- consider string-string as whole word

opt.conceallevel = 0

-- remove comment continuation in next line
vim.api.nvim_create_autocmd("BufEnter", {
	callback = function()
		vim.opt.formatoptions:remove({ "c", "r", "o" })
	end,
	group = vim.api.nvim_create_augroup("General", { clear = true }),
	desc = "Disable New Line Comment",
})

-- Highlight when yanking (copying) text
--  Try it with `yap` in normal mode
--  See `:help vim.highlight.on_yank()`
vim.api.nvim_create_autocmd("TextYankPost", {
	desc = "Highlight when yanking (copying) text",
	group = vim.api.nvim_create_augroup("kickstart-highlight-yank", { clear = true }),
	callback = function()
		vim.highlight.on_yank()
	end,
})

vim.api.nvim_create_autocmd("VimEnter", {
	desc = "Auto select virtualenv Nvim opens",
	pattern = "*",
	callback = function()
		local pyproject = vim.fn.findfile("pyproject.toml", vim.fn.getcwd() .. ";")
		local pipfile = vim.fn.findfile("Pipfile.lock", vim.fn.getcwd() .. ";")
		local poetrylock = vim.fn.findfile("poetry.lock", vim.fn.getcwd() .. ";")

		if pyproject ~= "" or pipfile ~= "" or poetrylock ~= "" then
			require("venv-selector").retrieve_from_cache()
			print("Virtual environment activated") -- Optional: Debug message
		end
	end,
	once = true,
})
