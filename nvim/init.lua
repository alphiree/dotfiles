vim.g.python3_host_prog = "~/workflow-packages/.pyenv/versions/neovim/bin/python"

-- To load python files faster using pyenv-virtualenvs:
-- pyenv virtualenv 3.10.7 neovim
-- pyenv activate neovim
-- pip install pynvim
--
-- pyenv which python
--
-- Then, paste the directory to the `python3_host_prog` above so it will use the python provider when starting python files

vim.g.loaded_ruby_provider = 0
vim.g.loaded_perl_provider = 0
vim.g.loaded_node_provider = 0

require("core.keymaps")
require("core.options")
require("core.autocmd")
require(".lsp")
require(".lazy")
