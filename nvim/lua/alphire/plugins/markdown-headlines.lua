return {
	"lukas-reineke/headlines.nvim",
	version = "*",
	dependencies = "nvim-treesitter/nvim-treesitter",
	config = function()
		vim.cmd([[highlight Headline guibg=#201c1c]])
		vim.cmd([[highlight CodeBlock guibg=#201c1c]])
		vim.cmd([[highlight Quote guibg=NONE guifg=#201c1c]])
		require("headlines").setup({
			markdown = {
				headline_highlights = { "NONE" },
				bullet_highlights = {
					"@text.title.1.marker.markdown",
					"@text.title.2.marker.markdown",
					"@text.title.3.marker.markdown",
					"@text.title.4.marker.markdown",
					"@text.title.5.marker.markdown",
					"@text.title.6.marker.markdown",
				},
				bullets = { "◉", "○", "✸", "✿" },
				codeblock_highlight = "CodeBlock",
				dash_highlight = "Dash",
				dash_string = "-",
				backtick_highlight = "CodeBlock",
				quote_highlight = "Quote",
				quote_string = "┃",
				fat_headlines = false,
			},
		})
	end,
}
