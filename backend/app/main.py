from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text, inspect
import httpx
import re
import os
import io
from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.routers import auth, admin, annotator
from app.seed import seed_database
from app.models.image import Image

# Google Drive API imports
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Image processing imports
from PIL import Image as PILImage
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIF_SUPPORT = True
except ImportError:
    HEIF_SUPPORT = False

# Import all models so Base knows about them
from app.models import user, image, category, option, annotator_category, annotation, image_assignment, edit_request, notification  # noqa
from app.models import settings as settings_model  # noqa - rename to avoid conflict with config.settings

# Google Drive service account setup from settings
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def get_drive_service():
    """Create Google Drive API service using service account from settings."""
    # Handle escaped newlines in private key
    private_key = settings.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace('\\n', '\n')
    
    credentials_info = {
        "type": settings.GOOGLE_SERVICE_ACCOUNT_TYPE,
        "project_id": settings.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
        "private_key_id": settings.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
        "private_key": private_key,
        "client_email": settings.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        "client_id": settings.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    
    credentials = service_account.Credentials.from_service_account_info(
        credentials_info, scopes=SCOPES
    )
    return build('drive', 'v3', credentials=credentials)

# Create tables
Base.metadata.create_all(bind=engine)

# Add missing columns to existing tables (lightweight migration)
def _migrate():
    inspector = inspect(engine)
    if "annotations" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("annotations")}
        with engine.begin() as conn:
            if "review_status" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN review_status VARCHAR(20)"))
            if "review_note" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN review_note TEXT"))
            if "reviewed_by" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN reviewed_by INTEGER REFERENCES users(id)"))
            if "reviewed_at" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN reviewed_at TIMESTAMPTZ"))
            if "time_spent_seconds" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN time_spent_seconds INTEGER DEFAULT 0 NOT NULL"))
            if "is_rework" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN is_rework BOOLEAN DEFAULT FALSE NOT NULL"))
            if "rework_time_seconds" not in existing:
                conn.execute(text("ALTER TABLE annotations ADD COLUMN rework_time_seconds INTEGER DEFAULT 0 NOT NULL"))
        print("[MIGRATE] Checked/added review columns to annotations table")
    # Add improper columns to images table
    if "images" in inspector.get_table_names():
        existing_img = {col["name"] for col in inspector.get_columns("images")}
        with engine.begin() as conn:
            if "is_improper" not in existing_img:
                conn.execute(text("ALTER TABLE images ADD COLUMN is_improper BOOLEAN DEFAULT FALSE NOT NULL"))
            if "improper_reason" not in existing_img:
                conn.execute(text("ALTER TABLE images ADD COLUMN improper_reason TEXT"))
            if "marked_improper_by" not in existing_img:
                conn.execute(text("ALTER TABLE images ADD COLUMN marked_improper_by INTEGER REFERENCES users(id)"))
            if "marked_improper_at" not in existing_img:
                conn.execute(text("ALTER TABLE images ADD COLUMN marked_improper_at TIMESTAMPTZ"))
        print("[MIGRATE] Checked/added improper columns to images table")

_migrate()

app = FastAPI(
    title="Photo Pets Annotation Tool",
    description="Image annotation tool for pet photo categorization",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(annotator.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Image Proxy Endpoint ─────────────────────────────────────────
# Proxies images from Google Drive to bypass CORS restrictions

@app.get("/api/images/proxy/{image_id}")
def proxy_image(image_id: int):
    """
    Proxy endpoint to fetch images from Google Drive using service account.
    This bypasses CORS restrictions by fetching server-side with proper authentication.
    Converts HEIC/HEIF images to JPEG for browser compatibility.
    """
    db = SessionLocal()
    try:
        img = db.query(Image).filter(Image.id == image_id).first()
        if not img:
            raise HTTPException(status_code=404, detail="Image not found")
        
        url = img.url
        
        # Extract Google Drive file ID if it's a Google Drive URL
        gdrive_match = re.search(r'id=([a-zA-Z0-9_-]+)', url)
        if not gdrive_match:
            raise HTTPException(status_code=400, detail="Invalid Google Drive URL")
        
        file_id = gdrive_match.group(1)
        
        try:
            # Use Google Drive API to download the file
            service = get_drive_service()
            
            # Get file metadata to determine mime type
            file_metadata = service.files().get(fileId=file_id, fields='mimeType,name').execute()
            mime_type = file_metadata.get('mimeType', 'image/png')
            filename = file_metadata.get('name', '').lower()
            
            # Download the file content
            request = service.files().get_media(fileId=file_id)
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            file_buffer.seek(0)
            
            # Check if this is a HEIC/HEIF file that needs conversion
            is_heic = (
                mime_type in ('image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence') or
                filename.endswith('.heic') or filename.endswith('.heif')
            )
            
            if is_heic and HEIF_SUPPORT:
                # Convert HEIC to JPEG for browser compatibility
                try:
                    pil_image = PILImage.open(file_buffer)
                    # Convert to RGB if necessary (HEIC might have alpha)
                    if pil_image.mode in ('RGBA', 'P'):
                        pil_image = pil_image.convert('RGB')
                    
                    output_buffer = io.BytesIO()
                    pil_image.save(output_buffer, format='JPEG', quality=90)
                    output_buffer.seek(0)
                    content = output_buffer.read()
                    mime_type = 'image/jpeg'
                except Exception as conv_err:
                    print(f"HEIC conversion failed for {file_id}: {conv_err}")
                    # Fall back to original content
                    file_buffer.seek(0)
                    content = file_buffer.read()
            else:
                content = file_buffer.read()
            
            return Response(
                content=content,
                media_type=mime_type,
                headers={
                    "Cache-Control": "public, max-age=86400",  # Cache for 1 day
                }
            )
        except Exception as e:
            print(f"Error fetching image {file_id}: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to fetch image: {str(e)}")
    finally:
        db.close()
