#!/bin/bash

# # Check if Kitty is running
# if pgrep -x "kitty" > /dev/null; then
#     # Get the window ID of the running Kitty instance
#     kitty_window=$(osascript -e 'tell application "System Events" to get the first process whose name is "kitty"')
#
#     # If the window is visible, hide it
#     osascript -e 'tell application "Kitty" to set miniaturized of every window to true'
# else
#     # If not running, launch Kitty
#     open -na "kitty"
# fi
#
# #!/bin/bash
# # Check if Kitty is running
# if pgrep -x "kitty" > /dev/null; then
#     # Get the window ID of the running Kitty instance
#     kitty_window=$(osascript -e 'tell application "System Events" to get the first process whose name is "kitty"')
#
#     # Toggle visibility: Hide if visible, Show if hidden
#     osascript -e 'tell application "System Events"
#         set appName to "kitty"
#         set isHidden to (visible of application process appName)
#         set visible of application process appName to not isHidden
#     end tell'
# else
#     # Start Kitty if not running
#     nohup kitty >/dev/null 2>&1 &
# fi

# Check if Kitty is running
if pgrep -x "kitty" > /dev/null; then
    # Toggle Kitty's visibility using AppleScript for minimal delay
    osascript -e '
        tell application "System Events"
            set isRunning to (exists (processes where name is "kitty"))
            if isRunning then
                set isVisible to visible of process "kitty"
                set visible of process "kitty" to not isVisible
            end if
        end tell
    '
else
    # Start Kitty if not running
    nohup kitty >/dev/null 2>&1 &
fi

