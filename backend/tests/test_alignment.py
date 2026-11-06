"""Mock model-independent IPC tests plus an actual Windows process-tree timeout."""
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Event, Thread
import unittest
from unittest.mock import patch

import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.alignment import AlignmentService


class AlignmentTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.service = AlignmentService(python=sys.executable, runner=__file__, temp_dir=self.temp.name)
        self.waveform = np.ones(16000, np.float32)

    def reply(self, **changes):
        data = {"version": 1, "transcript": "Mock words.", "alignment_status": "completed",
                "words": [{"word": "Mock", "start": 0.1, "end": 0.2}, {"word": "words.", "start": 0.3, "end": 0.4}],
                "unaligned_words": []}
        data.update(changes)
        return 0, json.dumps(data), "diagnostic stderr"

    def assert_clean(self):
        self.assertEqual(list(Path(self.temp.name).iterdir()), [])

    def test_structured_contract_success_and_cleanup(self):
        def run(payload):
            self.assertEqual(payload["transcript"], "Mock words.")
            self.assertEqual(payload["version"], 1)
            self.assertEqual(payload["sample_rate"], 16000)
            self.assertTrue(Path(payload["waveform_path"]).is_absolute())
            np.testing.assert_array_equal(np.load(payload["waveform_path"], allow_pickle=False), self.waveform)
            return self.reply()
        with patch.object(self.service, "_run_process", side_effect=run):
            result = self.service.align(self.waveform, "Mock words.")
        self.assertEqual(result.alignment_status, "completed")
        self.assertEqual(result.words[0], {"word": "Mock", "start": 0.1, "end": 0.2})
        self.assert_clean()

    def test_subprocess_failure_is_safe_and_cleaned(self):
        with patch.object(self.service, "_run_process", return_value=(1, "garbage", "private/path sensitive error")):
            result = self.service.align(self.waveform, "Mock words.")
        self.assertEqual(result.alignment_status, "failed")
        self.assertNotIn("private/path", result.alignment_error)
        self.assert_clean()

    def test_timeout_fallback_cleanup_and_slot_release(self):
        with patch.object(self.service, "_run_process", side_effect=subprocess.TimeoutExpired("test", 1)):
            for _ in range(2):
                result = self.service.align(self.waveform, "Mock words.")
                self.assertEqual(result.alignment_status, "failed")
                self.assertIn("timed out", result.alignment_error)
                self.assert_clean()

    def test_missing_environment(self):
        self.service.python = Path(self.temp.name) / "missing.exe"
        result = self.service.align(self.waveform, "Mock words.")
        self.assertEqual(result.alignment_status, "failed")
        self.assertIn("unavailable", result.alignment_error)
        self.assert_clean()

    def test_empty_transcript_skips_subprocess(self):
        with patch.object(self.service, "_run_process") as run:
            self.assertEqual(self.service.align(self.waveform, "").alignment_status, "skipped")
            run.assert_not_called()
        self.assert_clean()

    def test_invalid_json_and_timestamps(self):
        cases = [(0, "not JSON", ""), self.reply(words=[{"word": "Mock", "start": -1, "end": 0.1}]),
                 self.reply(words=[{"word": "Mock", "start": float("nan"), "end": 0.1}]),
                 self.reply(transcript="Expected replacement"), self.reply(words=[]),
                 self.reply(words=[{"word": "unexpected", "start": 0.1, "end": 0.2}])]
        for response in cases:
            with self.subTest(response=response), patch.object(self.service, "_run_process", return_value=response):
                self.assertEqual(self.service.align(self.waveform, "Mock words.").alignment_status, "failed")
                self.assert_clean()

    def test_reordered_words_rejected(self):
        response = self.reply(words=[{"word": "words.", "start": 0.1, "end": 0.2}, {"word": "Mock", "start": 0.3, "end": 0.4}])
        with patch.object(self.service, "_run_process", return_value=response):
            self.assertEqual(self.service.align(self.waveform, "Mock words.").alignment_status, "failed")
        self.assert_clean()

    def test_partial_result_preserved(self):
        response = self.reply(alignment_status="partial", words=[{"word": "Mock", "start": 0.1, "end": 0.2}], unaligned_words=["words."])
        with patch.object(self.service, "_run_process", return_value=response):
            result = self.service.align(self.waveform, "Mock words.")
        self.assertEqual(result.alignment_status, "partial")
        self.assertEqual(result.unaligned_words, ["words."])
        self.assertEqual(len(result.words), 1)
        self.assert_clean()

    def test_concurrent_subprocesses_prevented(self):
        entered, release = Event(), Event()
        def run(payload):
            entered.set()
            release.wait(3)
            return self.reply()
        with patch.object(self.service, "_run_process", side_effect=run) as execute:
            thread = Thread(target=lambda: self.service.align(self.waveform, "Mock words."))
            thread.start()
            try:
                self.assertTrue(entered.wait(2))
                result = self.service.align(self.waveform, "Mock words.")
                self.assertEqual(result.alignment_status, "failed")
                self.assertIn("busy", result.alignment_error)
                self.assertEqual(execute.call_count, 1)
            finally:
                release.set()
                thread.join(5)
        self.assert_clean()

    @unittest.skipUnless(os.name == "nt", "Windows process-tree handling")
    def test_real_timeout_terminates_python_descendant(self):
        import ctypes
        from ctypes import wintypes
        runner = Path(self.temp.name) / "slow.py"
        pid_file = Path(self.temp.name) / "child.pid"
        runner.write_text("import subprocess,sys,time\nfrom pathlib import Path\np=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'])\nPath(" + repr(str(pid_file)) + ").write_text(str(p.pid))\ntime.sleep(60)\n")
        self.service.runner = runner
        self.service.timeout = 2
        with self.assertRaises(subprocess.TimeoutExpired):
            self.service._run_process({})
        self.assertTrue(pid_file.exists(), "Descendant must actually start to exercise tree cleanup")
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.OpenProcess(0x1000, False, int(pid_file.read_text()))
        if handle:
            try:
                code = wintypes.DWORD()
                self.assertTrue(kernel.GetExitCodeProcess(handle, ctypes.byref(code)))
                self.assertNotEqual(code.value, 259, "Alignment descendant is still active")
            finally:
                kernel.CloseHandle(handle)


if __name__ == "__main__":
    unittest.main()
