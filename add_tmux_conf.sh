#!/bin/bash

# create the tmux directory in the user's home directory
# if it doesn't already exist

if [ ! -d ~/.config/tmux ]; then
    mkdir -p ~/.config/tmux
fi

# copy the tmux.conf to the user's home directory
cp tmux/tmux.conf ~/.config/tmux/tmux.conf 

