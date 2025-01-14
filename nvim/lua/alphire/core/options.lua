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

-- Replace functionality for visual selection with next instance navigation
vim.keymap.set("v", "<leader>r", function()
	-- Store the visual selection
	vim.cmd('normal! "vy"')
	local selected_text = vim.fn.getreg("v")

	-- Prompt for replacement text
	local replacement = vim.fn.input("Replace '" .. selected_text .. "' with: ")
	if replacement == "" then
		return
	end

	-- Ask if user wants to replace all instances
	local replace_all = vim.fn.input("Replace all instances? (y/n): ")

	-- Replace current instance first
	vim.cmd('normal! gv"_c' .. replacement)

	if replace_all:lower() == "y" then
		-- Replace all remaining instances
		local cmd = "%s/" .. vim.fn.escape(selected_text, "/\\") .. "/" .. vim.fn.escape(replacement, "/\\") .. "/gc"
		vim.cmd(cmd)
	else
		-- Function to find and prompt for next instance
		local function find_and_prompt_next()
			-- Search for next instance
			local found = vim.fn.search(selected_text, "W")
			if found == 0 then
				print("No more instances found.")
				return
			end

			-- Move cursor to the instance and center the screen
			vim.cmd("normal! zz")

			-- Highlight the instance
			vim.cmd("normal! v" .. string.len(selected_text) - 1 .. "l")
			vim.cmd("redraw") -- Force screen update to show the selection

			-- Ask if user wants to replace this instance
			local do_replace = vim.fn.input("Replace this instance? (y/n/q): ")

			if do_replace:lower() == "y" then
				-- Replace this instance
				vim.cmd("normal! c" .. replacement)
				-- Continue to next instance
				vim.schedule(find_and_prompt_next)
			elseif do_replace:lower() == "n" then
				-- Clear the visual selection and continue
				vim.cmd("normal! <Esc>")
				vim.schedule(find_and_prompt_next)
			elseif do_replace:lower() == "q" then
				-- Quit the replacement process
				vim.cmd("normal! <Esc>")
				print("Replacement process stopped.")
				return
			end
		end

		-- Start finding next instances
		find_and_prompt_next()
	end
end, { noremap = true, silent = true, desc = "Replace selection with navigation" })
