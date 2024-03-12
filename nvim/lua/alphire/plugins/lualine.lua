return {
    "nvim-lualine/lualine.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function()
        local auto_theme_custom = require('lualine.themes.monokai-pro')
        auto_theme_custom.normal.c.bg = 'none'
        require('lualine').setup {
            options = {
                -- theme = "catppuccin"
                theme = auto_theme_custom
                -- ... the rest of your lualine config
            }
        }
    end,
}
