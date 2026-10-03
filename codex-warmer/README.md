# Codex warmer

A small Linux **user-systemd** timer that sends one tool-free Pi request at daily
slots. It is optional and is not part of the dotfiles bootstrap. The schedule is
kept in one ignored local JSON file; the generator renders both literal
`OnCalendar` entries (systemd cannot interpolate environment variables there) and
the service's lateness guard from that same file.

A scheduled request consumes whatever provider quota/account access it uses. It
cannot guarantee a reset, included-only usage, or that paid credit is never used.
It does not inspect quota, buy credit, retry, or test provider access.

## Requirements

Linux with a running user systemd manager, Python 3.9+ with `zoneinfo`, Pi, and
the Node runtime needed by your Pi installation. Pi must already have a working
login and access to the selected model. The generated unit runs Pi as your user;
it is not an OS sandbox.

## Configure and generate

```bash
cd ~/dotfiles/codex-warmer
cp config.example.json config.local.json
$EDITOR config.local.json

# Default: validate only; does not write, link, reload, enable, or make a request.
./warmer.py --config config.local.json

# Explicitly render ignored units under generated/.
./warmer.py --config config.local.json generate

# Offline syntax verification; this makes no provider request.
systemd-analyze --user verify generated/codex-warmer.service generated/codex-warmer.timer
```

`config.local.json` is intentionally ignored and is where machine-specific
timezone, slots, Pi executable, PATH (including Node), Pi agent directory, model,
thinking level, timeouts, and unit name belong. Use absolute paths: systemd does
not expand `~` or `$HOME`. The committed example uses generic, valid values only.
The generator rejects unsafe newlines, relative paths, invalid zones/schedules,
and unsafe model identifiers; it quotes spaces, escapes `%`, and clearly rejects `$` in paths.
Generated units record the checkout's helper path, so regenerate after moving the checkout.

Slots are daily `HH:MM` values in increasing order. `grace_seconds` defaults to
30: a service firing later than that is skipped, including a delayed suspend
resume. A slot near midnight remains eligible for its grace period on the next
local day. The timer and guard use the configured timezone's local wall clock;
a DST jump can skip an absent local slot and a repeated local time may be seen
twice. The timer is non-persistent, does not wake the computer, has no random
delay, and services cannot overlap. `timeout_start_seconds` and
`timeout_stop_seconds` default to 45 and 5.

The generated request uses `--offline`, no session, no tools, no extensions,
skills, prompts, themes, or context files. A private runtime working directory
writes Pi settings that disable retries and compaction; it disappears with the
systemd runtime directory.

## Install is explicit and inert

After reviewing generated files, create links only with the explicit command:

```bash
./warmer.py --config config.local.json install
```

It first refuses any existing service or timer file/link, without changing
`generated/`, then writes `generated/` and adds **new** symlinks in
`$XDG_CONFIG_HOME/systemd/user` (or `~/.config/systemd/user`). It does not run
`systemctl`, reload units, enable a timer, start a service, or make a network
request. Choose a different non-template `unit_name` or manually retire an old
unit before installing a replacement. If desired, activation remains a deliberate
later step:

```bash
systemctl --user daemon-reload
systemctl --user enable --now codex-warmer.timer
systemctl --user list-timers --all codex-warmer.timer
```

To stop it later, use `systemctl --user disable --now codex-warmer.timer` and,
if needed, `systemctl --user stop codex-warmer.service`.

## Existing local legacy units

This checkout previously had `codex-warmer.service` and `codex-warmer.timer` at
the module root, and the current user-unit links may still point to them. They
are intentionally retained as ignored local legacy files and this generator
never writes or replaces them. The generated units live only in `generated/`.
That preserves existing unit behavior until you explicitly choose and install a
new unit name/link.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

The tests validate configuration errors, schedule-to-guard rendering, timezone
boundary behavior, escaping for unusual paths, and `systemd-analyze --user
verify` for temporary generated units. They do not invoke Pi or contact a
provider.
