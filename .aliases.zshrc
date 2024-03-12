# Aliases

alias v='nvim'

alias cls='clear'

alias lc='ls -Glash --color'

alias pylatest='pyenv install --list | grep --extended-regexp "^\s*[0-9][0-9.]*[0-9]\s*$" | tail -1'

alias gitlog="git log --graph --abbrev-commit --decorate --format=format:'%C(yellow)%h%C(reset) - %C(dim normal)%aD%C(reset) %C(dim normal)(%ar)%C(reset)%C(auto)%d%C(reset)%n''          %C(bold white)%s%C(reset) %C(normal)- %an%C(reset)'"

alias gitmain='git log origin main --oneline'

alias zshrc='nvim ~/.zshrc'

alias gs='git status'
