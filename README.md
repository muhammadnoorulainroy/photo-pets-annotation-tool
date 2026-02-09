# Photo Pets Annotation Tool

An image annotation tool for pet photo categorization. Annotators are assigned categories by an admin and annotate images one category at a time. Features a shared queue (once any annotator completes an image for a category, it's done for everyone), admin review with inline editing and bulk approval, and automatic resume so annotators pick up where they left off.

## Architecture

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL
- **Frontend:** React + Tailwind CSS + Vite
- **Auth:** JWT-based with `admin` and `annotator` roles

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### Environment Variables

Copy the example files and update values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Backend (`backend/.env`):**

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/photo_pets` |
| `SECRET_KEY` | JWT signing secret (change in production) | — |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `480` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3000` |
| `BACKEND_URL` | Backend URL | `http://localhost:8000` |
| `SEED_ADMINS` | JSON array of admin users to create on first run | See `.env.example` |

**Frontend (`frontend/.env`):**

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |

### Backend

```bash
cd backend
python -m venv .venv        # or use the project-level venv
.venv/Scripts/activate       # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend starts on `http://localhost:8000`. On first run it will:
- **Auto-create** the `photo_pets` database if it doesn't exist
- **Auto-create** all tables and run lightweight migrations
- **Seed** admin users (from `SEED_ADMINS` env var), 6 annotation categories with options, and 20 mock images (from picsum.photos)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` and proxies API requests to the backend.

## Usage

### Admin Flow

1. Log in with admin credentials (configured in `SEED_ADMINS`)
2. **Users & Assignments** tab — create annotator accounts (with auto-generate password), assign one or more categories to each annotator
3. **Progress** tab — monitor annotation progress per annotator and category
4. **Image Status** tab — see per-image completion across all categories (paginated)
5. **Review** tab — review completed annotations:
   - Table view with image thumbnails, category columns, and annotator selections
   - Click an image to open a detail modal with a large image and all category annotations side-by-side
   - Inline edit any annotation's selected options before approving
   - Bulk approve multiple images at once via row checkboxes
   - Keyboard shortcuts: `↑↓` navigate rows, `Enter` open modal, `←→` prev/next in modal, `A` approve all pending, `?` show shortcuts

### Annotator Flow

1. Log in with annotator credentials
2. See assigned categories with progress bars (showing shared completion)
3. Click a category to start annotating — **automatically resumes** from the first unannotated image
4. For each image: select applicable options, optionally mark as duplicate
5. Use **Save & Next**, **Skip**, or **Back** to navigate
6. Keyboard shortcuts: `→`/`Enter` Save & Next, `←` Back, `S` Skip
7. Skip will **not** overwrite already-completed annotations
8. Shared queue: once any annotator completes an image for a category, other annotators skip it automatically

### Annotation Categories

- Lighting Variation
- Angle & Perspective Variation
- Environmental Context Variation
- Occlusion & Partial Visibility
- Activity & Motion
- Multi-Pet Disambiguation

Plus an optional "Is Duplicate?" flag per image.

## API Documentation

Visit `http://localhost:8000/docs` for the interactive Swagger UI.
