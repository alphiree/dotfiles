#!/bin/bash

# copy the alias.bashrc to the user's home directory
cp aliases.bashrc ~/.config/aliases.bashrc

# add the following line to the user's .bashrc file
echo ". ~/.config/aliases.bashrc" >> ~/.bashrc

# source the .bashrc file
source ~/.bashrc




