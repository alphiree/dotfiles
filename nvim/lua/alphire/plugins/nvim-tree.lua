return {
	"nvim-tree/nvim-tree.lua",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	config = function()
		local nvimtree = require("nvim-tree")

		-- recommended settings from nvim-tree documentation
		vim.g.loaded_netrw = 1
		vim.g.loaded_netrwPlugin = 1

		-- optionally enable 24-bit colour
		vim.opt.termguicolors = true

		-- change color for arrows in tree
		vim.cmd([[ highlight NvimTreeFolderArrowClosed guifg=#fed65e ]])
		vim.cmd([[ highlight NvimTreeFolderArrowOpen guifg=#fed65e ]])

		-- configure nvim-tree
		nvimtree.setup({
			view = {
				width = 35,
				relativenumber = true,
			},
			-- change folder arrow icons
			renderer = {
				indent_markers = {
					enable = true,
				},
				icons = {
					glyphs = {
						folder = {
							arrow_closed = "", -- arrow when folder is closed
							arrow_open = "", -- arrow when folder is open
						},
					},
				},
			},
			-- disable window_picker for
			-- explorer to work well with
			-- window splits
			actions = {
				open_file = {
					window_picker = {
						enable = false,
					},
					quit_on_open = true,
				},
			},
			filters = {
				dotfiles = false,
				custom = { ".DS_Store", "node_modules/.*" },
			},
			git = {
				ignore = false,
			},
			update_focused_file = {
				enable = true,
				update_root = false,
			},
		})
		if vim.fn.argc() == 0 then
			vim.cmd("NvimTreeOpen")
		end
	end,
}
