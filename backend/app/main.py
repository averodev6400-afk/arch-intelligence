import uvicorn
import asyncio
import os

from configs.logger import logger
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from configs.settings import settings
from contextlib import asynccontextmanager
from configs.database import connect_db
from configs.response import SuccessResponse, ErrorResponse

from src import nodes_router, archs_router, scenarios_router

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads", "icons")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield


app = FastAPI(
    title="Arch Intelligence API",
    description="API for Arch Intelligence application",
    version="1.0.0",
    lifespan=lifespan,
    root_path="/v1",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get(
    path="/health",
    summary="Health Check",
    description="Endpoint to check the health of the application",
    tags=["Health"],
    response_model=SuccessResponse[dict],
    responses={
        200: {"model": SuccessResponse[dict], "description": "Successful response"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def health_check():
    logger.info("Healthy check endpoint hit")
    return SuccessResponse[dict](message="Hello, World!", data={"status": "healthy"})

app.include_router(nodes_router)
app.include_router(archs_router)
app.include_router(scenarios_router)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "uploads")), name="uploads")


@app.post(
    path="/upload/icon",
    summary="Upload an icon image",
    description="Upload a small icon image (max 2MB). Returns the URL path to the uploaded file.",
    tags=["Upload"],
    response_model=SuccessResponse[dict],
    responses={
        200: {"model": SuccessResponse[dict], "description": "File uploaded successfully"},
        400: {"model": ErrorResponse, "description": "Invalid file"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def upload_icon(file: UploadFile = File(...)):
    import uuid

    # Validate file type
    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"}
    if file.content_type not in allowed_types:
        return ErrorResponse(message="Invalid file type. Allowed: png, jpeg, webp, svg, gif", error_code="INVALID_FILE_TYPE")

    # Validate file size (max 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        return ErrorResponse(message="File too large. Max 2MB allowed.", error_code="FILE_TOO_LARGE")

    # Save file
    ext = os.path.splitext(file.filename or "icon.png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    icon_url = f"/v1/uploads/icons/{filename}"
    return SuccessResponse[dict](message="Icon uploaded successfully.", data={"url": icon_url})

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=True if settings.APP_ENV == "development" else False,
        log_config=None,
    )
