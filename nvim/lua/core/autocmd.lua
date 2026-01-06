vim.api.nvim_create_autocmd("BufEnter", {
	desc = "Remove comment continuation in next line",
	callback = function()
		vim.opt.formatoptions:remove({ "c", "r", "o" })
	end,
	group = vim.api.nvim_create_augroup("General", { clear = true }),
})

vim.api.nvim_create_autocmd("TextYankPost", {
	desc = "Highlight when yanking (copying) text",
	group = vim.api.nvim_create_augroup("kickstart-highlight-yank", { clear = true }),
	callback = function()
		vim.highlight.on_yank()
	end,
})

-- vim.api.nvim_create_autocmd("VimEnter", {
-- 	desc = "Auto select virtualenv Nvim opens",
-- 	pattern = "*",
-- 	callback = function()
-- 		local pyproject = vim.fn.findfile("pyproject.toml", vim.fn.getcwd() .. ";")
--
-- 		if pyproject ~= "" then
-- 			require("venv-selector").retrieve_from_cache()
-- 			print("Virtual environment activated") -- Optional: Debug message
-- 		end
-- 	end,
-- 	once = true,
-- })

-- vim.api.nvim_create_autocmd("VimEnter", {
-- 	desc = "Auto select virtualenv when opening Python project",
-- 	callback = function()
-- 		local pyproject = vim.fn.findfile("pyproject.toml", vim.fn.getcwd() .. ";")
--
-- 		if pyproject ~= "" then
-- 			vim.cmd("VenvSelectCached")
-- 		end
-- 	end,
-- 	once = true,
-- })
