local M = {}

-- Neovim cannot create real blur. It can only remove cell backgrounds so
-- kitty/KDE can show the blurred transparent terminal behind it.
local base_groups = {
	"Normal",
	"NormalNC",
	"NormalFloat",
	"FloatBorder",
	"FloatTitle",
	"SignColumn",
	"FoldColumn",
	"EndOfBuffer",
	"StatusLine",
	"StatusLineNC",
	"TabLine",
	"TabLineFill",
	"TabLineSel",
	"WinSeparator",
	"Pmenu",
	"PmenuSel",
	"MsgArea",
	"TelescopeNormal",
	"TelescopeBorder",
	"TelescopePromptNormal",
	"TelescopePromptBorder",
	"TelescopeResultsNormal",
	"TelescopeResultsBorder",
	"TelescopePreviewNormal",
	"TelescopePreviewBorder",
}

local prefixes = {
	"Oil",
}

local function clear_bg(group)
	local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = group, link = false })
	if not ok then
		return
	end

	-- nvim_set_hl replaces the whole highlight group, so preserve existing fg/style.
	hl.bg = nil
	hl.ctermbg = nil
	pcall(vim.api.nvim_set_hl, 0, group, hl)
end

local function clear_prefix(prefix)
	local all = vim.api.nvim_get_hl(0, {})
	for group, _ in pairs(all) do
		if group:sub(1, #prefix) == prefix then
			clear_bg(group)
		end
	end
end

function M.apply()
	if vim.env.NVIM_TRANSPARENT == "0" then
		return
	end

	for _, group in ipairs(base_groups) do
		clear_bg(group)
	end

	-- Keep line numbers readable. Only clear the gutter background and set sane fg.
	vim.api.nvim_set_hl(0, "LineNr", { fg = "#69676c", bg = "NONE" })
	vim.api.nvim_set_hl(0, "CursorLineNr", { fg = "#f8e579", bg = "NONE", bold = true })

	for _, prefix in ipairs(prefixes) do
		clear_prefix(prefix)
	end
end

vim.api.nvim_create_autocmd({ "VimEnter", "ColorScheme", "FileType", "WinEnter" }, {
	group = vim.api.nvim_create_augroup("UserTransparentBackground", { clear = true }),
	pattern = { "*" },
	callback = function()
		vim.schedule(M.apply)
	end,
})

M.apply()

return M
