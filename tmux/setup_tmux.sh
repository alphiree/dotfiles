#!/usr/bin/env bash

# Exit on error
set -e

ROOT_DIR=${HOME}

cd ${ROOT_DIR}

# Clean up
rm -rf ~/libevent-2.1.12-stable.tar.gz
rm -rf ~/ncurses-6.2.tar.gz
rm -rf ~/tmux-3.4.tar.gz


# Download packages that needed for installation of tmux
wget "https://invisible-mirror.net/archives/ncurses/ncurses-6.2.tar.gz" -P ~/
wget "https://github.com/libevent/libevent/releases/download/release-2.1.12-stable/libevent-2.1.12-stable.tar.gz" -P ~/

# Download tmux (version 3.4)
wget "https://github.com/tmux/tmux/releases/download/3.4/tmux-3.4.tar.gz" -P ~/

tar xvf "libevent-2.1.12-stable.tar.gz"
tar xvf "ncurses-6.2.tar.gz"
tar xvf "tmux-3.4.tar.gz"

# Install libevent
cd libevent-2.1.12-stable
./autogen.sh
./configure --prefix=${ROOT_DIR}/.local
make
make install
cd ..

# Install ncurses
cd ncurses-6.2
./configure --prefix=${ROOT_DIR}/.local
make
make install
cd ..

# Install tmux
cd tmux-3.4
./configure --prefix=${ROOT_DIR}/.local \
    CFLAGS="-I${ROOT_DIR}/.local/include -I${ROOT_DIR}/.local/include/ncurses" \
    LDFLAGS="-L${ROOT_DIR}/.local/include -L${ROOT_DIR}/.local/include/ncurses -L${ROOT_DIR}/.local/lib"
make
make install
cd ..

# Move tmux to usr/bin
mv ${ROOT_DIR}/.local/bin/tmux /usr/bin/tmux

# Clean up
rm -rf libevent-2.1.12-stable*
rm -rf ncurses-6.2*
rm -rf tmux-3.4*

echo "[SUCCESS] tmux is now installed!"
echo "tmux version: $(tmux -V)"




