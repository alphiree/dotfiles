return {
    "akinsho/bufferline.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    version = "*",
    after = "catppuccin",
    event = "BufReadPre",
    config = function()
        local bufferline = require("bufferline")
        bufferline.setup({
            highlights = require("catppuccin.groups.integrations.bufferline").get(),
            options = {
                offsets = {
                    {
                        filetype = "NvimTree",
                        text = "File Explorer",
                        highlights = "Directory",
                        separator = true,
                    }
                },
               -- separator_style = "slant",
               mode = "buffer",
            }
        })
    end
}
