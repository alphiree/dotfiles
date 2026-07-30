local M = {}

function M.setup()
	require("touchup").setup({
		filetypes = { "markdown" },
		bullets = {
			enabled = true,
			icons = { "✸", "✿", "✦", "✧" },
		},
		checkboxes = { enabled = true },
		code_blocks = { enabled = true },
		markers = { enabled = true },
		quotes = { enabled = true },
		enter = { enabled = true },
	})
end

return M
