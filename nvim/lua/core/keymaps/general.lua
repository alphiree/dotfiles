local keymap = vim.keymap

-- General keymaps
keymap.set("n", "<leader>q", "<cmd>q<CR>", { desc = "Exit nvim" })
keymap.set("n", "<leader>nh", ":nohl<CR>", { desc = "Clear search highlights" })
keymap.set("n", "<Esc>", "<cmd>nohlsearch<CR>")

keymap.set("n", "zz", ":update<CR>", { silent = true, desc = "Save file" })
keymap.set("v", "zz", "<C-C>:update<CR>", { silent = true, desc = "Save file" })

keymap.set("n", "<leader>k", "zM", { desc = "Fold all" })
keymap.set("n", "<leader>j", "zR", { desc = "Unfold all" })

keymap.set("n", "x", '"_x')
keymap.set("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move line down" })
keymap.set("v", "K", ":m '>-2<CR>gv=gv", { desc = "Move line up" })
keymap.set("x", "p", '"_dP')

keymap.set("v", "<leader>y", '"+y')

keymap.set("n", "d", '"_d')
keymap.set("n", "dd", '"_dd')
keymap.set("n", "diw", '"_diw')

keymap.set("n", "<c-f>", "/", { desc = "Search in current buffer" })
keymap.set("n", "<leader>s", [[:%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>]])

keymap.set("n", "<C-d>", "<C-d>zz")
keymap.set("n", "<C-u>", "<C-u>zz")
keymap.set("n", "n", "nzzzv")
keymap.set("n", "N", "Nzzzv")

keymap.set("n", "<leader>br", function()
	vim.cmd("edit!")
	print("Buffer reloaded")
end, { desc = "Reload current buffer" })

keymap.set("n", "<leader>S", "<cmd>LspStop<CR>", { desc = "LspStop" })

keymap.set("n", "<leader>cp", function()
	vim.fn.setreg("+", vim.fn.expand("%:p"))
	print("Path copied to clipboard")
end, { desc = "Copy current path to clipboard" })

keymap.set("n", "<leader>nf", function()
	local filename = vim.fn.input("Enter filename: ")
	if filename == "" then
		return
	end

	vim.cmd("edit %:h/" .. filename)
end, { desc = "Create file in current directory" })

keymap.set("n", "<leader>+", "<C-a>", { desc = "Increment number" })
keymap.set("n", "<leader>-", "<C-x>", { desc = "Decrement number" })

-- Replace all instances of highlighted text in a buffer
keymap.set("v", "<leader>r", function()
	vim.cmd('normal! "vy')
	local selected_text = vim.fn.getreg("v")
	local replacement = vim.fn.input("Replace '" .. selected_text .. "' with: ")

	if replacement == "" then
		return
	end

	local replace_all = vim.fn.input("Replace all instances? (y/n): ")
	vim.cmd('normal! gv"_c' .. replacement)

	if replace_all:lower() == "y" then
		local cmd = "%s/" .. vim.fn.escape(selected_text, "/\\") .. "/" .. vim.fn.escape(replacement, "/\\") .. "/gc"
		vim.cmd(cmd)
		return
	end

	local function find_and_prompt_next()
		local found = vim.fn.search(selected_text, "W")
		if found == 0 then
			print("No more instances found.")
			return
		end

		vim.cmd("normal! zz")
		vim.cmd("normal! v" .. string.len(selected_text) - 1 .. "l")
		vim.cmd("redraw")

		local do_replace = vim.fn.input("Replace this instance? (y/n/q): ")
		if do_replace:lower() == "y" then
			vim.cmd("normal! c" .. replacement)
			vim.schedule(find_and_prompt_next)
		elseif do_replace:lower() == "n" then
			vim.cmd("normal! <Esc>")
			vim.schedule(find_and_prompt_next)
		elseif do_replace:lower() == "q" then
			vim.cmd("normal! <Esc>")
			print("Replacement process stopped.")
		end
	end

	find_and_prompt_next()
end, { noremap = true, silent = true, desc = "Replace selection with navigation" })
