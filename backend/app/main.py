from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routers import auth, admin, annotator
from app.seed import seed_database

# Import all models so Base knows about them
from app.models import user, image, category, option, annotator_category, annotation  # noqa

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
        print("[MIGRATE] Checked/added review columns to annotations table")

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
