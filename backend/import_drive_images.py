"""
Script to import images from Google Drive folder into the database.
Uses service account authentication.
"""

import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from sqlalchemy import create_engine, text

# Configuration
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.heif'}

# Load .env file manually
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                value = value.strip()
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                os.environ[key.strip()] = value

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    sys.exit(1)

# Google Drive folder ID from environment
ROOT_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "1orx__x-85P5tGSkhMc-mw03-bBIA0BrA")


def get_drive_service():
    """Create Google Drive API service using service account from environment."""
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
    
    # Build credentials info from environment variables
    private_key = os.getenv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '')
    # Handle escaped newlines in private key
    private_key = private_key.replace('\\n', '\n')
    
    credentials_info = {
        "type": os.getenv('GOOGLE_SERVICE_ACCOUNT_TYPE', 'service_account'),
        "project_id": os.getenv('GOOGLE_SERVICE_ACCOUNT_PROJECT_ID'),
        "private_key_id": os.getenv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID'),
        "private_key": private_key,
        "client_email": os.getenv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL'),
        "client_id": os.getenv('GOOGLE_SERVICE_ACCOUNT_CLIENT_ID'),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    
    credentials = service_account.Credentials.from_service_account_info(
        credentials_info, scopes=SCOPES
    )
    
    service = build('drive', 'v3', credentials=credentials)
    return service


def list_files_in_folder(service, folder_id, folder_path=""):
    """Recursively list all image files in a folder and its subfolders."""
    images = []
    
    # Query for files in this folder
    query = f"'{folder_id}' in parents and trashed = false"
    
    page_token = None
    while True:
        response = service.files().list(
            q=query,
            spaces='drive',
            fields='nextPageToken, files(id, name, mimeType)',
            pageToken=page_token,
            pageSize=1000
        ).execute()
        
        for file in response.get('files', []):
            file_name = file['name']
            file_id = file['id']
            mime_type = file['mimeType']
            
            if mime_type == 'application/vnd.google-apps.folder':
                # Recursively process subfolder
                subfolder_path = f"{folder_path}/{file_name}" if folder_path else file_name
                print(f"  📁 Entering folder: {subfolder_path}")
                images.extend(list_files_in_folder(service, file_id, subfolder_path))
            else:
                # Check if it's an image file
                ext = os.path.splitext(file_name.lower())[1]
                if ext in IMAGE_EXTENSIONS or mime_type.startswith('image/'):
                    image_info = {
                        'id': file_id,
                        'name': file_name,
                        'folder': folder_path,
                        'full_path': f"{folder_path}/{file_name}" if folder_path else file_name,
                        # Use the Google Drive direct view URL
                        'url': f"https://drive.google.com/uc?export=view&id={file_id}"
                    }
                    images.append(image_info)
                    print(f"    🖼️  Found: {image_info['full_path']}")
        
        page_token = response.get('nextPageToken')
        if not page_token:
            break
    
    return images


def import_images_to_database(images, replace_existing=True):
    """Import the found images into the database."""
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        # First, clear existing images if requested
        result = conn.execute(text("SELECT COUNT(*) FROM images"))
        existing_count = result.scalar()
        
        if existing_count > 0 and replace_existing:
            print(f"\n⚠️  Found {existing_count} existing images. Replacing...")
            # Clear related data first (due to foreign keys)
            conn.execute(text("DELETE FROM annotation_selections"))
            conn.execute(text("DELETE FROM annotations"))
            conn.execute(text("DELETE FROM edit_requests"))
            conn.execute(text("DELETE FROM notifications WHERE image_id IS NOT NULL"))
            conn.execute(text("DELETE FROM annotator_image_assignments"))
            conn.execute(text("DELETE FROM images"))
            print("  🗑️  Cleared existing images and related data.")
        
        # Insert new images
        inserted = 0
        for img in images:
            # Check if image with same filename already exists
            check = conn.execute(
                text("SELECT id FROM images WHERE filename = :filename"),
                {"filename": img['name']}
            ).fetchone()
            
            if check:
                continue
            
            conn.execute(
                text("""
                    INSERT INTO images (filename, url, is_improper)
                    VALUES (:filename, :url, FALSE)
                """),
                {"filename": img['name'], "url": img['url']}
            )
            inserted += 1
        
        print(f"\n✅ Inserted {inserted} new images into the database.")
    
    engine.dispose()


def main():
    print("=" * 60)
    print("Google Drive Image Importer")
    print("=" * 60)
    print(f"\n📂 Root folder ID: {ROOT_FOLDER_ID}")
    print(f"🔑 Service account: {SERVICE_ACCOUNT_FILE}")
    print(f"💾 Database: {DATABASE_URL[:50]}...")
    print("\n🔍 Scanning Google Drive for images...\n")
    
    try:
        service = get_drive_service()
        
        # Test connection by getting folder info
        folder_info = service.files().get(fileId=ROOT_FOLDER_ID, fields='name').execute()
        print(f"📁 Connected to folder: {folder_info.get('name', 'Unknown')}\n")
        
        # List all images
        images = list_files_in_folder(service, ROOT_FOLDER_ID)
        
        print(f"\n📊 Found {len(images)} images total.")
        
        if images:
            print("\n" + "-" * 40)
            print("Sample images found:")
            for img in images[:5]:
                print(f"  • {img['full_path']}")
            if len(images) > 5:
                print(f"  ... and {len(images) - 5} more")
            print("-" * 40)
            
            # Auto-import to database
            print("\n🚀 Importing images...")
            import_images_to_database(images, replace_existing=True)
            
            # Verify
            engine = create_engine(DATABASE_URL)
            with engine.connect() as conn:
                count = conn.execute(text("SELECT COUNT(*) FROM images")).scalar()
                print(f"\n📊 Database now has {count} images")
            engine.dispose()
        else:
            print("\n⚠️  No images found. Make sure the folder is shared with the service account.")
            print(f"   Service account email: google-drive-access@turing-genai-ws.iam.gserviceaccount.com")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
