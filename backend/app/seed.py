"""Seed database with categories, options, default admin, and mock images."""
from sqlalchemy.orm import Session
from app.config import settings
from app.models.user import User
from app.models.category import Category
from app.models.option import Option
from app.models.image import Image
from app.services.auth import hash_password


CATEGORIES_DATA = [
    {
        "name": "Lighting Variation",
        "display_order": 1,
        "options": [
            ("Dusk-dawn lighting", False),
            ("Harsh outdoor sunlight with shadows", False),
            ("Low light conditions", False),
            ("Well-lit conditions (typical)", True),
        ],
    },
    {
        "name": "Angle & Perspective Variation",
        "display_order": 2,
        "options": [
            ("Front-facing at eye level (typical)", True),
            ("Ground-level view", False),
            ("No head showing", False),
            ("Partial view (head only)", False),
            ("Top-down view", False),
        ],
    },
    {
        "name": "Environmental Context Variation",
        "display_order": 3,
        "options": [
            ("In car-carrier", False),
            ("Indoor setting (typical)", True),
            ("Outdoor dirt road", False),
            ("Snow environment", False),
            ("Vet clinic", False),
            ("Yard with a complex background", False),
        ],
    },
    {
        "name": "Occlusion & Partial Visibility",
        "display_order": 4,
        "options": [
            ("Behind furniture (face only)", False),
            ("Full-body, unobstructed (typical)", True),
            ("Partially hidden under a blanket", False),
            ("Peeking out of box-carrier", False),
            ("Toy obscuring part of body", False),
        ],
    },
    {
        "name": "Activity & Motion",
        "display_order": 5,
        "options": [
            ("Eating-drinking", False),
            ("Jumping to catch toy", False),
            ("Playing with another pet", False),
            ("Running with motion blur", False),
            ("Sitting still-posed (typical)", True),
            ("Sleeping-curled up", False),
        ],
    },
    {
        "name": "Multi-Pet Disambiguation",
        "display_order": 6,
        "options": [
            ("Pet with breed lookalike", False),
            ("Single pet (typical)", True),
            ("Three pets of same breed", False),
            ("Two similar-looking pets together", False),
        ],
    },
]

# Mock pet images from picsum (deterministic seeds for consistent images)
MOCK_IMAGES = [
    {"filename": f"pet_{i:03d}.jpg", "url": f"https://picsum.photos/seed/pet{i}/800/600"}
    for i in range(1, 21)  # 20 mock images
]


def seed_database(db: Session):
    """Seed only if tables are empty."""

    # Seed admin users from env
    for admin_data in settings.seed_admins_list:
        username = admin_data.get("username")
        password = admin_data.get("password")
        full_name = admin_data.get("full_name", "")
        if not username or not password:
            print(f"[SEED] Skipping admin entry with missing username or password")
            continue
        existing = db.query(User).filter(User.username == username).first()
        if not existing:
            admin = User(
                username=username,
                password_hash=hash_password(password),
                full_name=full_name,
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"[SEED] Created admin user: {username}")

    # Seed categories & options
    if db.query(Category).count() == 0:
        for cat_data in CATEGORIES_DATA:
            category = Category(
                name=cat_data["name"],
                display_order=cat_data["display_order"],
            )
            db.add(category)
            db.flush()
            for order, (label, is_typical) in enumerate(cat_data["options"], start=1):
                option = Option(
                    category_id=category.id,
                    label=label,
                    is_typical=is_typical,
                    display_order=order,
                )
                db.add(option)
        db.commit()
        print(f"[SEED] Created {len(CATEGORIES_DATA)} categories with options")

    # Seed mock images
    if db.query(Image).count() == 0:
        for img_data in MOCK_IMAGES:
            db.add(Image(filename=img_data["filename"], url=img_data["url"]))
        db.commit()
        print(f"[SEED] Created {len(MOCK_IMAGES)} mock images")
