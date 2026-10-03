#!/usr/bin/env python3
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("warmer", ROOT / "warmer.py")
assert SPEC and SPEC.loader
warmer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = warmer
SPEC.loader.exec_module(warmer)


def example_data() -> dict:
    return json.loads((ROOT / "config.example.json").read_text(encoding="utf-8"))


class WarmerTests(unittest.TestCase):
    def write_config(self, directory: Path, data: dict) -> Path:
        path = directory / "config.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def test_validation_rejects_bad_schedule_and_relative_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            data = example_data()
            data["slots"] = ["09:02", "04:00"]
            with self.assertRaisesRegex(ValueError, "increasing"):
                warmer.load_config(self.write_config(directory, data))
            data = example_data()
            data["pi_executable"] = "~/bin/pi"
            with self.assertRaisesRegex(ValueError, "absolute path"):
                warmer.load_config(self.write_config(directory, data))
            data = example_data()
            data["timezone"] = "not/a-zone"
            with self.assertRaisesRegex(ValueError, "IANA zone"):
                warmer.load_config(self.write_config(directory, data))
            data = example_data()
            data["path"] = ["/opt/$node", "/usr/bin"]
            with self.assertRaisesRegex(ValueError, "unsupported in systemd"):
                warmer.load_config(self.write_config(directory, data))
            data = example_data()
            data["typoed_slot"] = "04:00"
            with self.assertRaisesRegex(ValueError, "unknown configuration key"):
                warmer.load_config(self.write_config(directory, data))
            data = example_data()
            data["unit_name"] = "codex@warmer"
            with self.assertRaisesRegex(ValueError, "not @ templates"):
                warmer.load_config(self.write_config(directory, data))

    def test_timer_and_guard_share_the_configured_schedule(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            data = example_data()
            data["slots"] = ["01:23", "12:34"]
            data["timezone"] = "Asia/Tokyo"
            config = warmer.load_config(self.write_config(Path(temporary), data))
            service, timer = warmer.render_units(config, ROOT / "warmer.py")
        self.assertIn("OnCalendar=*-*-* 01:23:00 Asia/Tokyo", timer)
        self.assertIn("OnCalendar=*-*-* 12:34:00 Asia/Tokyo", timer)
        self.assertIn('"01:23,12:34"', service)
        self.assertIn('"Asia/Tokyo"', service)

    def test_guard_boundaries_use_configured_timezone(self) -> None:
        slots = ("04:00",)
        # This UTC instant is 04:00 in Manila, proving the guard does not use host TZ.
        exact = datetime(2026, 1, 1, 20, 0, 0, tzinfo=ZoneInfo("UTC"))
        self.assertTrue(warmer.is_due(exact, "Asia/Manila", slots, 30))
        self.assertTrue(
            warmer.is_due(datetime(2026, 1, 1, 20, 0, 30, tzinfo=ZoneInfo("UTC")), "Asia/Manila", slots, 30)
        )
        self.assertFalse(
            warmer.is_due(datetime(2026, 1, 1, 20, 0, 31, tzinfo=ZoneInfo("UTC")), "Asia/Manila", slots, 30)
        )
        self.assertFalse(
            warmer.is_due(datetime(2026, 1, 1, 19, 59, 59, tzinfo=ZoneInfo("UTC")), "Asia/Manila", slots, 30)
        )
        midnight_slots = ("23:59",)
        self.assertTrue(
            warmer.is_due(datetime(2026, 1, 2, 0, 0, 30, tzinfo=ZoneInfo("Asia/Manila")), "Asia/Manila", midnight_slots, 120)
        )
        self.assertFalse(
            warmer.is_due(datetime(2026, 1, 2, 0, 1, 1, tzinfo=ZoneInfo("Asia/Manila")), "Asia/Manila", midnight_slots, 120)
        )

    def test_paths_with_spaces_and_percent_are_escaped(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            data = example_data()
            data["pi_executable"] = "/opt/Pi tools/paid%/pi"
            data["agent_dir"] = "/opt/Pi agent/state%"
            data["path"] = ["/opt/Node tools/bin%", "/usr/bin"]
            config = warmer.load_config(self.write_config(Path(temporary), data))
            service, _ = warmer.render_units(config, Path("/opt/warmer tools/source%/warmer.py"))
        self.assertIn('"/opt/Pi tools/paid%%/pi"', service)
        self.assertIn('"/opt/warmer tools/source%%/warmer.py"', service)
        self.assertIn('Environment="PI_CODING_AGENT_DIR=/opt/Pi agent/state%%"', service)
        self.assertIn('Environment="PATH=/opt/Node tools/bin%%:/usr/bin"', service)

    def test_install_refuses_before_changing_existing_generated_sources(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            fake_pi = directory / "pi"
            fake_pi.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            fake_pi.chmod(0o755)
            data = example_data()
            data["pi_executable"] = str(fake_pi)
            config = warmer.load_config(self.write_config(directory, data))
            output = directory / "generated"
            output.mkdir()
            service_source, timer_source = warmer.output_paths(config, output)
            service_source.write_text("existing generated service", encoding="utf-8")
            timer_source.write_text("existing generated timer", encoding="utf-8")
            unit_dir = directory / "user-units"
            unit_dir.mkdir()
            linked_service = unit_dir / service_source.name
            linked_service.symlink_to(service_source)
            original_link = linked_service.readlink()
            with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
                warmer.install(config, output, unit_dir)
            self.assertEqual(service_source.read_text(encoding="utf-8"), "existing generated service")
            self.assertEqual(timer_source.read_text(encoding="utf-8"), "existing generated timer")
            self.assertTrue(linked_service.is_symlink())
            self.assertEqual(linked_service.readlink(), original_link)
            self.assertFalse((unit_dir / timer_source.name).exists())

    @unittest.skipUnless(shutil.which("systemd-analyze"), "systemd-analyze is required for unit verification")
    def test_generated_units_pass_systemd_verify_offline(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            fake_pi = directory / "Pi tools" / "paid%" / "pi"
            fake_pi.parent.mkdir(parents=True)
            fake_pi.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            fake_pi.chmod(0o755)
            data = example_data()
            data["pi_executable"] = str(fake_pi)
            data["agent_dir"] = str(directory / "Pi agent" / "state%")
            data["path"] = [str(directory / "Node tools" / "bin%"), "/usr/bin"]
            config = warmer.load_config(self.write_config(directory, data))
            output = directory / "units"
            service_path, timer_path = warmer.write_units(config, output)
            result = subprocess.run(
                ["systemd-analyze", "--user", "verify", str(service_path), str(timer_path)],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                env={**__import__("os").environ, "PI_OFFLINE": "1"},
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
