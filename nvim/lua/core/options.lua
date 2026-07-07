local opt = vim.opt

-- line numbers
opt.relativenumber = true
opt.number = true

-- tabs & indentation
opt.tabstop = 4
opt.shiftwidth = 4
opt.expandtab = true
opt.autoindent = true

-- line wrapping
opt.wrap = false

-- folding
opt.foldmethod = "indent"
opt.foldlevel = 20

-- search
opt.ignorecase = true
opt.smartcase = true

-- appearance
opt.termguicolors = true
opt.signcolumn = "yes"

-- native completion (Neovim 0.12)
opt.complete = { ".^5", "w^5", "b^5", "u^5", "t^5" }
opt.completeopt = { "menuone", "noselect", "popup", "nearest" }
opt.pumheight = 12
pcall(function()
	vim.o.pummaxwidth = 80
	vim.o.pumborder = "rounded"
	vim.o.winborder = "rounded"
	vim.o.autocomplete = true
end)

-- editing
opt.backspace = "indent,eol,start"
opt.clipboard:append("unnamedplus")
opt.splitright = true
opt.splitbelow = true
opt.iskeyword:append("-")
opt.conceallevel = 0
