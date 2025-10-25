# Makefile — main entry point
OS := $(shell uname)

.PHONY: all setup system

all: setup system

setup:
ifeq ($(OS),Darwin)
	@echo "Detected macOS"
	@$(MAKE) -f Makefile.macos
else
	@echo "Detected Linux"
	@$(MAKE) -f Makefile.linux
	@$(MAKE) -f Makefile.system
endif

