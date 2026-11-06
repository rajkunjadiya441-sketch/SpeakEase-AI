"""Deterministic tests: all model outputs here are mocked, never clinical evidence."""
import io
from pathlib import Path
import sys
from threading import Event, Thread
from types import SimpleNamespace
import unittest
import wave
from unittest.mock import Mock, patch

import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.audio import decode_audio
from app.services.transcription import TranscriptionError, TranscriptionService
from test_upload import wav_bytes, webm_bytes


class TranscriptionTests(unittest.TestCase):
    def test_single_decode_and_mono_float_waveform(self):
        import av
        original = av.open
        with patch("app.services.audio.av.open", wraps=original) as open_audio:
            result = decode_audio(io.BytesIO(wav_bytes()), "audio/wav", 10485760, 30)
        self.assertEqual(open_audio.call_count, 1)
        self.assertEqual(result.waveform.shape, (16000,))
        self.assertEqual(result.waveform.dtype, np.float32)
        self.assertEqual(result.sample_rate, 16000)

    def test_stereo_wav_resampling(self):
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setparams((2, 2, 22050, 0, "NONE", "not compressed"))
            wav.writeframes(b"\x00\x10\x00\x08" * 22050)
        audio = decode_audio(io.BytesIO(buffer.getvalue()), "audio/wav", 10485760, 30)
        self.assertEqual(audio.waveform.shape, (16000,))
        self.assertEqual(audio.waveform.dtype, np.float32)

    def test_webm_resampling(self):
        result = decode_audio(io.BytesIO(webm_bytes()), "audio/webm", 10485760, 30)
        self.assertEqual(result.waveform.ndim, 1)
        self.assertAlmostEqual(result.waveform.size / 16000, 1, places=2)

    def test_model_reused_and_lazy_segments_consumed(self):
        model = Mock()
        visited = []
        def lazy(*args, **kwargs):
            def segments():
                visited.append(True)
                yield SimpleNamespace(text=" Mock words. ")
            return segments(), None
        model.transcribe.side_effect = lazy
        factory = Mock(return_value=model)
        service = TranscriptionService(model_factory=factory)
        for _ in range(2):
            self.assertEqual(service.transcribe(np.ones(16000, np.float32)).transcript, "Mock words.")
        self.assertEqual(factory.call_count, 1)
        self.assertEqual(len(visited), 2)
        self.assertEqual(factory.call_args.kwargs["device"], "cpu")
        self.assertEqual(factory.call_args.kwargs["compute_type"], "int8")
        self.assertFalse(model.transcribe.call_args.kwargs["word_timestamps"])
        self.assertTrue(model.transcribe.call_args.kwargs["vad_filter"])
        self.assertEqual(model.transcribe.call_args.kwargs["language"], "en")

    def test_silence_does_not_load_model(self):
        factory = Mock()
        result = TranscriptionService(model_factory=factory).transcribe(np.zeros(16000, np.float32))
        self.assertEqual(result.transcript, "")
        factory.assert_not_called()

    def test_no_segments_means_no_speech(self):
        model = Mock()
        model.transcribe.return_value = (iter([]), None)
        self.assertEqual(TranscriptionService(model_factory=Mock(return_value=model)).transcribe(np.ones(16000, np.float32)).transcript, "")

    def test_retry_after_initialization_failure_releases_slot(self):
        model = Mock()
        model.transcribe.side_effect = lambda *a, **kw: (iter([]), None)
        factory = Mock(side_effect=[RuntimeError("failed"), model])
        service = TranscriptionService(model_factory=factory)
        with self.assertRaises(TranscriptionError) as error:
            service.transcribe(np.ones(16000, np.float32))
        self.assertEqual(error.exception.status_code, 503)
        service.transcribe(np.ones(16000, np.float32))
        self.assertEqual(factory.call_count, 2)

    def test_lazy_failure_releases_slot_without_reload(self):
        model = Mock()
        def broken():
            raise RuntimeError("lazy failure")
            yield
        model.transcribe.side_effect = lambda *a, **kw: (broken(), None)
        factory = Mock(return_value=model)
        service = TranscriptionService(model_factory=factory)
        for _ in range(2):
            with self.assertRaises(TranscriptionError) as error:
                service.transcribe(np.ones(16000, np.float32))
            self.assertEqual(error.exception.status_code, 503)
        factory.assert_called_once()

    def test_concurrent_inference_rejected(self):
        entered, release = Event(), Event()
        model = Mock()
        def slow(*args, **kwargs):
            entered.set()
            release.wait(5)
            return iter([]), None
        model.transcribe.side_effect = slow
        service = TranscriptionService(model_factory=Mock(return_value=model))
        worker = Thread(target=lambda: service.transcribe(np.ones(16000, np.float32)))
        worker.start()
        try:
            self.assertTrue(entered.wait(2))
            with self.assertRaises(TranscriptionError) as error:
                service.transcribe(np.ones(16000, np.float32))
            self.assertEqual(error.exception.status_code, 429)
        finally:
            release.set()
            worker.join(5)

    def test_invalid_waveform(self):
        for waveform in [np.array([]), np.array([np.nan]), np.ones((2, 10))]:
            with self.assertRaises(TranscriptionError) as error:
                TranscriptionService().transcribe(waveform)
            self.assertEqual(error.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
