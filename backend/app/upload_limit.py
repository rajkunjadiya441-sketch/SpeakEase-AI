"""Bound multipart bodies before Starlette parses/spools uploads."""
from tempfile import SpooledTemporaryFile

from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse


class UploadLimitMiddleware:
    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_body_bytes = max_bytes + 65536  # bounded multipart fields/headers

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"].rstrip("/") != "/speech/analyze":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length."}, 400)(scope, receive, send)
        with SpooledTemporaryFile(max_size=1024 * 1024, mode="w+b") as body:
            total = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                total += len(chunk)
                if total > self.max_body_bytes:
                    return await JSONResponse({"detail": "Multipart upload exceeds the request size limit."}, 413)(scope, receive, send)
                await run_in_threadpool(body.write, chunk)
                if not message.get("more_body", False):
                    break
            body.seek(0)

            async def replay():
                chunk = await run_in_threadpool(body.read, 65536)
                more = body.tell() < total
                if not more:
                    body.close()
                return {"type": "http.request", "body": chunk, "more_body": more}

            await self.app(scope, replay, send)
