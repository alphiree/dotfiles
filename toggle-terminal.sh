#!/bin/bash

## Shows and hides the terminal and this will be implemented as a shorcut.

# Get the window ID of the application
app_window=$(xdotool search --onlyvisible --class "kitty")

if [ -n "$app_window" ]; then
    # If the window is found, check if it is minimized
    is_minimized=$(xprop -id $app_window | grep "_NET_WM_STATE_HIDDEN")

    if [ -n "$is_minimized" ]; then
        # If the window is minimized, restore it
        xdotool windowactivate $app_window
    else
        # If the window is visible, minimize it
        xdotool windowminimize $app_window
    fi
else
    # If no window is found, start the terminal
    kitty &
fi
