#!/usr/bin/env bash

# Minimal cross-platform battery status for tmux.
# Dependencies:
# - Linux: /sys/class/power_supply, provided by the kernel
# - macOS: pmset, provided by macOS

print_linux_battery() {
  local bat=""
  local capacity=""
  local status=""
  local icon=""

  for d in /sys/class/power_supply/*; do
    [ -f "$d/type" ] || continue
    if [ "$(cat "$d/type" 2>/dev/null)" = "Battery" ]; then
      bat="$d"
      break
    fi
  done

  [ -n "$bat" ] || return 0
  [ -f "$bat/capacity" ] || return 0

  capacity="$(cat "$bat/capacity" 2>/dev/null)"
  status="$(cat "$bat/status" 2>/dev/null || printf 'Unknown')"

  case "$status" in
    Charging) icon="󰂄" ;;
    Full|Not\ charging) icon="󰁹" ;;
    Discharging|*) icon="󰁹" ;;
  esac

  [ -n "$capacity" ] && printf '%s %s%%' "$icon" "$capacity"
}

print_macos_battery() {
  command -v pmset >/dev/null 2>&1 || return 0

  local line=""
  local capacity=""
  local icon=""

  line="$(pmset -g batt 2>/dev/null | grep -Eo '[0-9]+%; [^;]+' | head -n 1)"
  [ -n "$line" ] || return 0

  capacity="${line%%%;*}"

  case "$line" in
    *charging*) icon="󰂄" ;;
    *) icon="󰁹" ;;
  esac

  [ -n "$capacity" ] && printf '%s %s%%' "$icon" "$capacity"
}

case "$(uname -s 2>/dev/null)" in
  Linux) print_linux_battery ;;
  Darwin) print_macos_battery ;;
  *) exit 0 ;;
esac
