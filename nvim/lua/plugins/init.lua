local M = {}

local modules = {
	"plugins.theme",
	"plugins.treesitter",
	"plugins.editing",
	"plugins.git",
	"plugins.oil",
	"plugins.telescope",
	"plugins.lsp",
	"plugins.python",
	"plugins.ui",
}

function M.setup()
	for _, module in ipairs(modules) do
		local ok, plugin = pcall(require, module)
		if ok and type(plugin.setup) == "function" then
			plugin.setup()
		elseif not ok then
			vim.notify("Failed to load " .. module .. ": " .. plugin, vim.log.levels.ERROR)
		end
	end
end

return M
