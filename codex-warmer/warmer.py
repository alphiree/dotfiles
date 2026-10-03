#!/usr/bin/env python3
"""Generate a small, guarded systemd user timer for a Pi Codex request.

The JSON configuration is deliberately the only schedule input: render_units()
derives both OnCalendar lines and the service's lateness guard from it.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_CONFIG = Path(__file__).with_name("config.local.json")
DEFAULT_OUTPUT = Path(__file__).with_name("generated")
UNIT_NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\Z")
THINKING_LEVELS = {"off", "minimal", "low", "medium", "high", "xhigh", "max"}
ALLOWED_KEYS = {
    "timezone", "slots", "grace_seconds", "python", "pi_executable", "path",
    "agent_dir", "model", "thinking", "timeout_start_seconds",
    "timeout_stop_seconds", "unit_name",
}


@dataclass(frozen=True)
class Config:
    timezone: str
    slots: tuple[str, ...]
    grace_seconds: int
    python: str
    pi_executable: str
    path: tuple[str, ...]
    agent_dir: str
    model: str
    thinking: str
    timeout_start_seconds: int
    timeout_stop_seconds: int
    unit_name: str


def fail(message: str) -> None:
    raise ValueError(message)


def require_string(data: dict[str, Any], key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value:
        fail(f"{key} must be a non-empty string")
    if "\x00" in value or "\n" in value or "\r" in value:
        fail(f"{key} must not contain NUL or a newline")
    return value


def require_absolute_path(data: dict[str, Any], key: str) -> str:
    value = require_string(data, key)
    if "$" in value:
        fail(f"{key} must not contain $ (unsupported in systemd command paths)")
    if not Path(value).is_absolute():
        fail(f"{key} must be an absolute path (systemd does not expand ~ or $HOME)")
    return value


def parse_slot(slot: str) -> int:
    if not isinstance(slot, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", slot):
        fail("slots must contain HH:MM values in 24-hour time")
    hour, minute = map(int, slot.split(":"))
    return hour * 60 + minute


def load_config(path: Path) -> Config:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"configuration not found: {path}")
    except json.JSONDecodeError as error:
        fail(f"invalid JSON in {path}: {error.msg}")
    if not isinstance(raw, dict):
        fail("configuration root must be an object")
    unknown = sorted(set(raw) - ALLOWED_KEYS)
    if unknown:
        fail(f"unknown configuration key(s): {', '.join(unknown)}")

    timezone = require_string(raw, "timezone")
    if any(character.isspace() for character in timezone):
        fail("timezone must not contain whitespace")
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        fail(f"timezone is not an installed IANA zone: {timezone}")

    slots_raw = raw.get("slots")
    if not isinstance(slots_raw, list) or not slots_raw:
        fail("slots must be a non-empty JSON array")
    slots = tuple(slots_raw)
    minutes = [parse_slot(slot) for slot in slots]
    if len(set(minutes)) != len(minutes):
        fail("slots must not contain duplicates")
    if minutes != sorted(minutes):
        fail("slots must be in increasing daily order")

    grace = raw.get("grace_seconds", 30)
    if not isinstance(grace, int) or isinstance(grace, bool) or not 0 <= grace <= 3600:
        fail("grace_seconds must be an integer from 0 through 3600")

    path_raw = raw.get("path")
    if not isinstance(path_raw, list) or not path_raw:
        fail("path must be a non-empty JSON array of absolute directories")
    path_values: list[str] = []
    for index, directory in enumerate(path_raw):
        if not isinstance(directory, str) or not directory:
            fail(f"path[{index}] must be a non-empty string")
        if "\x00" in directory or "\n" in directory or "\r" in directory:
            fail(f"path[{index}] must not contain NUL or a newline")
        if "$" in directory:
            fail(f"path[{index}] must not contain $ (unsupported in systemd command paths)")
        if ":" in directory:
            fail(f"path[{index}] must not contain : (PATH uses it as a separator)")
        if not Path(directory).is_absolute():
            fail(f"path[{index}] must be an absolute directory")
        path_values.append(directory)

    model = require_string(raw, "model")
    if any(character.isspace() for character in model) or "$" in model or "%" in model:
        fail("model must not contain whitespace, $ or %")
    thinking = require_string(raw, "thinking")
    if thinking not in THINKING_LEVELS:
        fail(f"thinking must be one of: {', '.join(sorted(THINKING_LEVELS))}")

    def timeout(key: str, default: int) -> int:
        value = raw.get(key, default)
        if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= 3600:
            fail(f"{key} must be an integer from 1 through 3600")
        return value

    unit_name = raw.get("unit_name", "codex-warmer")
    if not isinstance(unit_name, str) or not UNIT_NAME_RE.fullmatch(unit_name):
        fail("unit_name may contain only letters, digits, _, . and - (not @ templates)")

    return Config(
        timezone=timezone,
        slots=slots,
        grace_seconds=grace,
        python=require_absolute_path(raw, "python"),
        pi_executable=require_absolute_path(raw, "pi_executable"),
        path=tuple(path_values),
        agent_dir=require_absolute_path(raw, "agent_dir"),
        model=model,
        thinking=thinking,
        timeout_start_seconds=timeout("timeout_start_seconds", 45),
        timeout_stop_seconds=timeout("timeout_stop_seconds", 5),
        unit_name=unit_name,
    )


def systemd_argument(value: str) -> str:
    """Return one literal Exec*= argument, without shell interpolation.

    %% protects systemd specifiers. Dollar signs are rejected rather than relying
    on systemd's command-environment expansion rules. Double quotes and
    backslashes use systemd's normal command-line escaping.
    """
    if "\x00" in value or "\n" in value or "\r" in value:
        fail("systemd command values must not contain NUL or a newline")
    if "$" in value:
        fail("systemd command values must not contain $; use a path without $")
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    escaped = escaped.replace("%", "%%")
    return f'"{escaped}"'


def systemd_environment(name: str, value: str) -> str:
    if "\x00" in value or "\n" in value or "\r" in value:
        fail(f"environment value {name} must not contain NUL or a newline")
    if "$" in value:
        fail(f"environment value {name} must not contain $; use a path without $")
    # Environment= does not perform shell expansion; %% protects unit specifiers.
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%")
    return f'Environment="{name}={escaped}"'


def is_due(now: datetime, timezone: str, slots: tuple[str, ...], grace_seconds: int) -> bool:
    """Whether *now* is in a slot's local wall-clock lateness window.

    The modulo keeps a late 23:59 slot valid just after local midnight. The
    configured grace is capped below one day, so it cannot select an older slot.
    """
    local = now.astimezone(ZoneInfo(timezone))
    current = local.hour * 3600 + local.minute * 60 + local.second
    return any((current - parse_slot(slot) * 60) % 86400 <= grace_seconds for slot in slots)


def render_units(config: Config, script_path: Path) -> tuple[str, str]:
    """Render timer and service from one validated Config instance."""
    runtime_directory = f"{config.unit_name}-runtime"
    slots_argument = ",".join(config.slots)
    timer_lines = [
        "[Unit]",
        "Description=Start a guarded Pi Codex warmer while the machine is awake",
        "",
        "[Timer]",
        *[f"OnCalendar=*-*-* {slot}:00 {config.timezone}" for slot in config.slots],
        "AccuracySec=1s",
        "RandomizedDelaySec=0",
        "Persistent=false",
        "WakeSystem=false",
        f"Unit={config.unit_name}.service",
        "",
        "[Install]",
        "WantedBy=timers.target",
        "",
    ]
    condition = " ".join(
        [
            systemd_argument(config.python),
            systemd_argument(str(script_path)),
            "guard",
            "--timezone",
            systemd_argument(config.timezone),
            "--slots",
            systemd_argument(slots_argument),
            "--grace-seconds",
            systemd_argument(str(config.grace_seconds)),
        ]
    )
    prepare = " ".join(
        [systemd_argument(config.python), systemd_argument(str(script_path)), "prepare-runtime"]
    )
    pi_command = " ".join(
        [
            systemd_argument(config.pi_executable),
            "--offline",
            "--model",
            systemd_argument(config.model),
            "--thinking",
            systemd_argument(config.thinking),
            "--no-session",
            "--no-tools",
            "--no-extensions",
            "--no-skills",
            "--no-prompt-templates",
            "--no-context-files",
            "--no-themes",
            "--approve",
            "--system-prompt",
            systemd_argument("Reply only OK."),
            "--append-system-prompt",
            systemd_argument(""),
            "--print",
            systemd_argument("Reply only OK."),
        ]
    )
    service_lines = [
        "[Unit]",
        "Description=One tiny, tool-free Pi Codex request",
        "",
        "[Service]",
        "Type=oneshot",
        systemd_environment("PATH", ":".join(config.path)),
        systemd_environment("PI_CODING_AGENT_DIR", config.agent_dir),
        "Environment=PI_OFFLINE=1",
        "Environment=PI_TELEMETRY=0",
        "UnsetEnvironment=NODE_OPTIONS NODE_PATH LD_PRELOAD LD_LIBRARY_PATH OPENAI_API_KEY PI_SESSION_ID PI_SESSION_FILE PI_PROVIDER PI_MODEL PI_REASONING_LEVEL",
        f"RuntimeDirectory={runtime_directory}",
        "RuntimeDirectoryMode=0700",
        f"WorkingDirectory=%t/{runtime_directory}",
        "UMask=0077",
        "NoNewPrivileges=yes",
        "# This is generated from the same slots as the timer; delayed firings are skipped.",
        f"ExecCondition={condition}",
        "# A private runtime project disables retries and compaction without changing global Pi settings.",
        f"ExecStartPre={prepare}",
        f"ExecStart={pi_command}",
        f"TimeoutStartSec={config.timeout_start_seconds}s",
        f"TimeoutStopSec={config.timeout_stop_seconds}s",
        "KillMode=control-group",
        "Restart=no",
        "StandardInput=null",
        "StandardOutput=journal",
        "StandardError=journal",
        f"SyslogIdentifier={config.unit_name}",
        "",
    ]
    return "\n".join(service_lines), "\n".join(timer_lines)


def output_paths(config: Config, output_dir: Path) -> tuple[Path, Path]:
    return output_dir / f"{config.unit_name}.service", output_dir / f"{config.unit_name}.timer"


def write_units(config: Config, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    service_path, timer_path = output_paths(config, output_dir)
    service, timer = render_units(config, Path(__file__).resolve())
    for path, contents in ((service_path, service), (timer_path, timer)):
        path.write_text(contents, encoding="utf-8")
        path.chmod(0o600)
    return service_path, timer_path


def default_unit_dir() -> Path:
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return config_home / "systemd" / "user"


def install(config: Config, output_dir: Path, unit_dir: Path) -> tuple[Path, Path]:
    service_path, timer_path = output_paths(config, output_dir)
    destinations = (unit_dir / service_path.name, unit_dir / timer_path.name)
    existing = [path for path in destinations if path.exists() or path.is_symlink()]
    if existing:
        names = ", ".join(str(path) for path in existing)
        fail(f"refusing to overwrite existing unit link/file: {names}")
    service_path, timer_path = write_units(config, output_dir)
    unit_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    for source, destination in zip((service_path, timer_path), destinations):
        destination.symlink_to(source)
    return destinations


def parse_slots_argument(value: str) -> tuple[str, ...]:
    slots = tuple(value.split(","))
    if not slots or any(not slot for slot in slots):
        fail("--slots must be a non-empty comma-separated HH:MM list")
    minutes = [parse_slot(slot) for slot in slots]
    if len(set(minutes)) != len(minutes) or minutes != sorted(minutes):
        fail("--slots must be distinct and increasing")
    return slots


def guard(args: argparse.Namespace) -> int:
    try:
        ZoneInfo(args.timezone)
        slots = parse_slots_argument(args.slots)
        if not 0 <= args.grace_seconds <= 3600:
            fail("--grace-seconds must be from 0 through 3600")
    except ValueError as error:
        print(f"codex-warmer guard configuration error: {error}", file=sys.stderr)
        return 2
    if is_due(datetime.now(tz=ZoneInfo(args.timezone)), args.timezone, slots, args.grace_seconds):
        print("Codex warmer: scheduled slot", flush=True)
        return 0
    print("Codex warmer: skipped outside the scheduled lateness window", flush=True)
    return 1


def prepare_runtime() -> int:
    settings = {
        "retry": {"enabled": False, "provider": {"maxRetries": 0, "timeoutMs": 30000}},
        "compaction": {"enabled": False},
        "transport": "sse",
        "enableInstallTelemetry": False,
    }
    directory = Path(".pi")
    directory.mkdir(mode=0o700, exist_ok=True)
    settings_path = directory / "settings.json"
    settings_path.write_text(json.dumps(settings), encoding="utf-8")
    settings_path.chmod(0o600)
    return 0


def config_for_args(args: argparse.Namespace) -> Config:
    return load_config(Path(args.config).expanduser().resolve())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="ignored local JSON configuration")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT), help="generated-unit directory")
    subparsers = parser.add_subparsers(dest="command", metavar="{preview,generate,install}")
    subparsers.add_parser("preview", help="validate and print generated unit paths (default)")
    subparsers.add_parser("generate", help="write generated unit files; does not install or enable them")
    install_parser = subparsers.add_parser("install", help="write units then add new user-unit symlinks; never enables them")
    install_parser.add_argument("--unit-dir", default=str(default_unit_dir()))
    guard_parser = subparsers.add_parser("guard", help=argparse.SUPPRESS)
    guard_parser.add_argument("--timezone", required=True)
    guard_parser.add_argument("--slots", required=True)
    guard_parser.add_argument("--grace-seconds", type=int, required=True)
    subparsers.add_parser("prepare-runtime", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    if args.command == "guard":
        return guard(args)
    if args.command == "prepare-runtime":
        return prepare_runtime()

    try:
        config = config_for_args(args)
        output_dir = Path(args.output_dir).expanduser().resolve()
        if args.command in (None, "preview"):
            service_path, timer_path = output_paths(config, output_dir)
            render_units(config, Path(__file__).resolve())
            print(f"valid configuration; would write:\n  {service_path}\n  {timer_path}")
        elif args.command == "generate":
            service_path, timer_path = write_units(config, output_dir)
            print(f"wrote:\n  {service_path}\n  {timer_path}")
        elif args.command == "install":
            destinations = install(config, output_dir, Path(args.unit_dir).expanduser().resolve())
            print("linked (not enabled; run daemon-reload/enable yourself if wanted):")
            print("\n".join(f"  {path}" for path in destinations))
        else:
            parser.error("unknown command")
    except ValueError as error:
        print(f"codex-warmer: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
