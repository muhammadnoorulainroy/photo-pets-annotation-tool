# Photo Pets Annotation Tool

An image annotation tool for pet photo categorization. Annotators are assigned categories by an admin and annotate images one category at a time.

## Architecture

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL
- **Frontend:** React + Tailwind CSS + Vite

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### Database

```bash
# Create the database
createdb photo_pets
# Or via psql:
# CREATE DATABASE photo_pets;
```

Update `backend/.env` with your PostgreSQL credentials if different from defaults.

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend starts on `http://localhost:8000`. On first run it auto-creates tables and seeds:
- Admin user: `admin` / `admin123`
- 6 annotation categories with all options
- 20 mock images (from picsum.photos)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` and proxies API requests to the backend.

## Usage

### Admin Flow

1. Log in as `admin` / `admin123`
2. Go to **Users & Assignments** tab
3. Create annotator accounts
4. Click **Assign** to assign categories to each annotator
5. Monitor progress in the **Progress** tab

### Annotator Flow

1. Log in with annotator credentials
2. See assigned categories with progress bars
3. Click a category to start annotating
4. For each image: select applicable options, optionally mark as duplicate
5. Use **Save & Next**, **Skip**, or **Back** to navigate
6. Keyboard shortcuts: `→` Save & Next, `←` Back, `S` Skip

## API Documentation

Visit `http://localhost:8000/docs` for the interactive Swagger UI.
