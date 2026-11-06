"""Live HTTP integration tests using real generated audio; no speech model."""
import io
import json
import math
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import wave

import av
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def wav_bytes(seconds=1):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        wav.writeframes(b"".join(struct.pack("<h", int(4000 * math.sin(2 * math.pi * 440 * i / 16000)))
                                 for i in range(int(16000 * seconds))))
    return buffer.getvalue()


def webm_bytes():
    buffer = io.BytesIO()
    with av.open(buffer, "w", format="webm") as container:
        stream = container.add_stream("libopus", rate=48000)
        stream.layout = "mono"
        for i in range(50):
            frame = av.AudioFrame(format="flt", layout="mono", samples=960)
            frame.sample_rate = 48000
            frame.pts = i * 960
            frame.planes[0].update(b"".join(struct.pack("<f", 0.1 * math.sin(2 * math.pi * 440 * (i * 960 + j) / 48000)) for j in range(960)))
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    return buffer.getvalue()


class UploadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="speakease-tests-")
        cls.wav = wav_bytes()
        cls.webm = webm_bytes()
        # Materialize actual fixture files; all are deleted at test teardown.
        Path(cls.temp.name, "valid.wav").write_bytes(cls.wav)
        Path(cls.temp.name, "valid.webm").write_bytes(cls.webm)
        cls.spool = Path(cls.temp.name, "spool")
        cls.spool.mkdir()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        env = os.environ.copy()
        env.update(MAX_UPLOAD_BYTES="10485760", MAX_AUDIO_DURATION_SECONDS="30", TEMP=str(cls.spool), TMP=str(cls.spool))
        env.pop("CORS_ORIGINS", None)
        env["PYTHONPATH"] = str(Path(__file__).resolve().parent)
        cls.proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "upload_test_server:app", "--port", str(port)], cwd=Path(__file__).resolve().parents[1], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(150):
            try:
                urlopen(cls.base + "/health", timeout=1).close()
                return
            except OSError:
                time.sleep(0.1)
        cls.proc.terminate()
        cls.proc.wait(timeout=10)
        cls.temp.cleanup()
        raise RuntimeError("Backend failed to start")

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=10)
        cls.temp.cleanup()

    def upload(self, data, mime="audio/wav", filename="recording.wav", expected="I have three apples", chunked=False, extra_headers=None):
        boundary = "speakease-test-boundary"
        body = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + data
        if expected is not None:
            body += f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="expected_text"\r\n\r\n{expected}'.encode()
        body += f"\r\n--{boundary}--\r\n".encode()
        payload = iter(body[i:i+65536] for i in range(0, len(body), 65536)) if chunked else body
        req = Request(self.base + "/speech/analyze", data=payload, headers={"Content-Type": f"multipart/form-data; boundary={boundary}", **(extra_headers or {})})
        try:
            response = urlopen(req, timeout=30)
        except HTTPError as exc:
            response = exc
        with response:
            result = (response.status, json.load(response))
        self.assertEqual(list(self.spool.iterdir()), [], "Temporary recordings were not removed")
        return result

    def test_valid_wav(self):
        code, data = self.upload(Path(self.temp.name, "valid.wav").read_bytes())
        self.assertEqual(code, 200)
        self.assertEqual(data, {"status": "completed", "processing_status": "completed", "filename": "recording.wav", "duration_seconds": 1.0, "expected_text": "I have three apples", "transcript": "Mock transcript.", "words": [{"word": "Mock", "start": 0.1, "end": 0.2}, {"word": "transcript.", "start": 0.2, "end": 0.3}], "alignment_status": "completed", "alignment_error": None, "unaligned_words": [], "model": "tiny", "language": "en"})

    def test_valid_webm(self):
        code, data = self.upload(Path(self.temp.name, "valid.webm").read_bytes(), "audio/webm;codecs=opus", "recording.webm")
        self.assertEqual(code, 200, data)
        self.assertAlmostEqual(data["duration_seconds"], 1, places=2)

    def test_expected_text_optional(self):
        code, data = self.upload(self.wav, expected=None)
        self.assertEqual(code, 200)
        self.assertIsNone(data["expected_text"])

    def test_empty(self):
        self.assertEqual(self.upload(b"")[0], 400)

    def test_corrupted(self):
        self.assertEqual(self.upload(b"not an audio file")[0], 422)

    def test_truncated_wav(self):
        self.assertEqual(self.upload(self.wav[:-100])[0], 422)

    def test_corrupted_webm(self):
        self.assertEqual(self.upload(b"\x1a\x45\xdf\xa3\x42\x82\x84webm" + b"bad data" * 20, "audio/webm")[0], 422)

    def test_unsupported(self):
        self.assertEqual(self.upload(b"ID3fake mp3", "audio/mpeg", "recording.mp3")[0], 415)

    def test_mime_mismatch(self):
        self.assertEqual(self.upload(self.wav, "audio/webm")[0], 415)

    def test_oversized_file(self):
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            wav.writeframes(b"\x00" * 10485760)
        self.assertEqual(self.upload(buffer.getvalue())[0], 413)

    def test_oversized_request(self):
        self.assertEqual(self.upload(b"x" * (10485760 + 100000))[0], 413)

    def test_chunked_oversized_request(self):
        self.assertEqual(self.upload(b"x" * (10485760 + 100000), chunked=True)[0], 413)

    def test_over_duration(self):
        self.assertEqual(self.upload(wav_bytes(30.1))[0], 422)

    def test_duration_boundary(self):
        self.assertEqual(self.upload(wav_bytes(30))[0], 200)

    def test_expected_text_too_long(self):
        self.assertEqual(self.upload(self.wav, expected="x" * 2001)[0], 422)

    def test_health_and_docs(self):
        with urlopen(self.base + "/health") as response:
            self.assertEqual(json.load(response), {"status": "ok", "service": "speakease-ai-backend"})
        with urlopen(self.base + "/openapi.json") as response:
            self.assertIn("/speech/analyze", json.load(response)["paths"])
        with urlopen(self.base + "/docs") as response:
            self.assertEqual(response.status, 200)

    def test_configurable_validation_limits(self):
        from app.services.audio import AudioValidationError, validate_audio
        with self.assertRaises(AudioValidationError) as size_error:
            validate_audio(io.BytesIO(self.wav), "audio/wav", 100, 30)
        self.assertEqual(size_error.exception.status_code, 413)
        with self.assertRaises(AudioValidationError) as duration_error:
            validate_audio(io.BytesIO(self.wav), "audio/wav", 10485760, 0.5)
        self.assertEqual(duration_error.exception.status_code, 422)

    def test_silent_audio(self):
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            wav.writeframes(b"\x00" * 32000)
        code, data = self.upload(buffer.getvalue())
        self.assertEqual(code, 200)
        self.assertEqual(data["status"], "no_speech")
        self.assertEqual(data["transcript"], "")
        self.assertEqual(data["words"], [])

    def test_model_initialization_failure(self):
        code, data = self.upload(self.wav, extra_headers={"X-Test-Mode": "init_failure"})
        self.assertEqual(code, 503)
        self.assertIn("could not be loaded", data["detail"])

    def test_lazy_inference_failure(self):
        code, data = self.upload(self.wav, extra_headers={"X-Test-Mode": "inference_failure"})
        self.assertEqual(code, 503)
        self.assertIn("transcription failed", data["detail"])

    def test_alignment_failure_preserves_transcript(self):
        code, data = self.upload(self.wav, extra_headers={"X-Test-Mode": "alignment_failure"})
        self.assertEqual(code, 200)
        self.assertEqual(data["transcript"], "Mock transcript.")
        self.assertEqual(data["expected_text"], "I have three apples")
        self.assertEqual(data["processing_status"], "completed")
        self.assertEqual(data["alignment_status"], "failed")
        self.assertTrue(data["alignment_error"])
        self.assertEqual(data["words"], [])

    def test_concurrent_pipeline_requests(self):
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(1) as pool:
            first = pool.submit(self.upload, self.wav, extra_headers={"X-Test-Mode": "slow"})
            time.sleep(0.2)
            code, data = self.upload(self.wav)
            self.assertEqual(code, 429)
            with urlopen(self.base + "/health") as response:
                self.assertEqual(response.status, 200)
            self.assertEqual(first.result()[0], 200)

    def test_cors_post(self):
        req = Request(self.base + "/speech/analyze", method="OPTIONS", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
        with urlopen(req) as response:
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://localhost:5173")


if __name__ == "__main__":
    unittest.main(verbosity=2)
