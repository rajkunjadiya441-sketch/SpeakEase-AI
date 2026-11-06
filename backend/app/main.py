from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.config import get_cors_origins, MAX_UPLOAD_BYTES
from app.api.speech import router as speech_router
from app.upload_limit import UploadLimitMiddleware

app = FastAPI(title="SpeakEase AI Backend", version="0.1.0")
app.add_middleware(UploadLimitMiddleware, max_bytes=MAX_UPLOAD_BYTES)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(health_router)

app.include_router(speech_router)
