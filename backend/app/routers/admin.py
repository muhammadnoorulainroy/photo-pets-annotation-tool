from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.models.category import Category
from app.models.image import Image
from app.models.annotation import Annotation
from app.models.annotator_category import AnnotatorCategory
from app.schemas.user import UserCreate, UserUpdate, UserResponse, AssignCategoriesRequest
from app.schemas.category import CategoryResponse
from app.models.annotation import AnnotationSelection
from app.models.option import Option
from app.schemas.annotation import (
    ProgressResponse, ImageCompletionResponse,
    ReviewApproveRequest, ReviewUpdateRequest, ReviewAnnotationDetail,
    ReviewTableCell, ReviewTableRow, ReviewTableCategory, ReviewTableResponse,
)
from app.services.auth import hash_password

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── User Management ──────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        result.append(UserResponse(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
            assigned_category_ids=[ac.category_id for ac in u.assigned_categories],
        ))
    return result


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        assigned_category_ids=[],
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        assigned_category_ids=[ac.category_id for ac in user.assigned_categories],
    )


# ── Category Assignment ──────────────────────────────────────────

@router.put("/users/{user_id}/categories")
def assign_categories(
    user_id: int,
    payload: AssignCategoriesRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "annotator":
        raise HTTPException(status_code=400, detail="Can only assign categories to annotators")

    # Remove existing assignments
    db.query(AnnotatorCategory).filter(AnnotatorCategory.user_id == user_id).delete()

    # Add new assignments
    for cat_id in payload.category_ids:
        cat = db.query(Category).filter(Category.id == cat_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail=f"Category {cat_id} not found")
        db.add(AnnotatorCategory(user_id=user_id, category_id=cat_id))

    db.commit()
    return {"message": "Categories assigned", "category_ids": payload.category_ids}


# ── Categories ────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    categories = (
        db.query(Category)
        .options(joinedload(Category.options))
        .order_by(Category.display_order)
        .all()
    )
    return categories


# ── Images ────────────────────────────────────────────────────────

@router.get("/images")
def list_images(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    images = db.query(Image).order_by(Image.id).all()
    return [
        {"id": img.id, "filename": img.filename, "url": img.url, "created_at": img.created_at}
        for img in images
    ]


# ── Progress ──────────────────────────────────────────────────────

@router.get("/progress", response_model=list[ProgressResponse])
def get_progress(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    total_images = db.query(Image).count()
    assignments = (
        db.query(AnnotatorCategory)
        .options(
            joinedload(AnnotatorCategory.user),
            joinedload(AnnotatorCategory.category),
        )
        .all()
    )
    result = []
    for assignment in assignments:
        completed = (
            db.query(Annotation)
            .filter(
                Annotation.annotator_id == assignment.user_id,
                Annotation.category_id == assignment.category_id,
                Annotation.status == "completed",
            )
            .count()
        )
        skipped = (
            db.query(Annotation)
            .filter(
                Annotation.annotator_id == assignment.user_id,
                Annotation.category_id == assignment.category_id,
                Annotation.status == "skipped",
            )
            .count()
        )
        in_prog = (
            db.query(Annotation)
            .filter(
                Annotation.annotator_id == assignment.user_id,
                Annotation.category_id == assignment.category_id,
                Annotation.status == "in_progress",
            )
            .count()
        )
        result.append(ProgressResponse(
            category_id=assignment.category_id,
            category_name=assignment.category.name,
            annotator_id=assignment.user_id,
            annotator_username=assignment.user.username,
            total_images=total_images,
            completed=completed,
            skipped=skipped,
            in_progress=in_prog,
            pending=total_images - completed - skipped - in_prog,
        ))
    return result


# ── Image Completion Status ───────────────────────────────────────

@router.get("/images/completion", response_model=list[ImageCompletionResponse])
def get_image_completion(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Per-image completion status.
    An image is fully complete when ALL categories have a 'completed'
    annotation for that image (by any annotator).
    """
    images = db.query(Image).order_by(Image.id).all()
    categories = db.query(Category).order_by(Category.display_order).all()

    # Build a set of category IDs that are currently assigned to someone
    assigned_cat_ids = set(
        row.category_id
        for row in db.query(AnnotatorCategory.category_id).distinct().all()
    )

    # Total = ALL categories, not just assigned ones
    total_cats = len(categories)

    result = []
    for img in images:
        # Get all annotations for this image
        annotations = (
            db.query(Annotation)
            .filter(Annotation.image_id == img.id)
            .all()
        )

        # Build per-category status (for ALL categories)
        cat_details = []
        completed_cats = 0
        for cat in categories:
            cat_annotations = [a for a in annotations if a.category_id == cat.id]

            if not cat_annotations:
                # No annotation exists — check if category is even assigned
                status = "pending" if cat.id in assigned_cat_ids else "unassigned"
                cat_details.append({
                    "category_id": cat.id,
                    "category_name": cat.name,
                    "status": status,
                    "annotator_username": None,
                })
            else:
                # Prefer completed, then in_progress, then skipped
                best = None
                for a in cat_annotations:
                    if a.status == "completed":
                        best = a
                        break
                if not best:
                    best = cat_annotations[0]

                if best.status == "completed":
                    completed_cats += 1

                annotator = db.query(User).filter(User.id == best.annotator_id).first()
                cat_details.append({
                    "category_id": cat.id,
                    "category_name": cat.name,
                    "status": best.status,
                    "annotator_username": annotator.username if annotator else None,
                })

        result.append(ImageCompletionResponse(
            image_id=img.id,
            image_filename=img.filename,
            image_url=img.url,
            total_categories=total_cats,
            completed_categories=completed_cats,
            category_details=cat_details,
            is_fully_complete=(completed_cats >= total_cats and total_cats > 0),
        ))

    return result


# ── Review ────────────────────────────────────────────────────────

@router.get("/review", response_model=list[ReviewAnnotationDetail])
def list_annotations_for_review(
    category_id: Optional[int] = Query(None),
    annotator_id: Optional[int] = Query(None),
    review_status: Optional[str] = Query(None),  # pending, approved
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    List completed annotations for admin review.
    Filterable by category, annotator, and review status.
    """
    query = (
        db.query(Annotation)
        .filter(Annotation.status == "completed")
        .options(
            joinedload(Annotation.image),
            joinedload(Annotation.annotator),
            joinedload(Annotation.category).joinedload(Category.options),
            joinedload(Annotation.selections),
            joinedload(Annotation.reviewer),
        )
    )

    if category_id is not None:
        query = query.filter(Annotation.category_id == category_id)
    if annotator_id is not None:
        query = query.filter(Annotation.annotator_id == annotator_id)
    if review_status == "pending":
        query = query.filter(Annotation.review_status.is_(None))
    elif review_status == "approved":
        query = query.filter(Annotation.review_status == "approved")

    annotations = (
        query.order_by(Annotation.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for a in annotations:
        selected_options = []
        for sel in a.selections:
            opt = db.query(Option).filter(Option.id == sel.option_id).first()
            if opt:
                selected_options.append({"id": opt.id, "label": opt.label})

        # All options in this category (for admin editing)
        all_options = [
            {"id": o.id, "label": o.label, "is_typical": o.is_typical}
            for o in sorted(a.category.options, key=lambda x: x.display_order)
        ]

        result.append(ReviewAnnotationDetail(
            id=a.id,
            image_id=a.image_id,
            image_url=a.image.url,
            image_filename=a.image.filename,
            annotator_id=a.annotator_id,
            annotator_username=a.annotator.username,
            category_id=a.category_id,
            category_name=a.category.name,
            is_duplicate=a.is_duplicate,
            status=a.status,
            review_status=a.review_status,
            review_note=a.review_note,
            reviewed_by_username=a.reviewer.username if a.reviewer else None,
            reviewed_at=a.reviewed_at,
            selected_options=selected_options,
            all_options=all_options,
            created_at=a.created_at,
            updated_at=a.updated_at,
        ))

    return result


@router.get("/review/table", response_model=ReviewTableResponse)
def review_table(
    annotator_id: Optional[int] = Query(None),
    review_status: Optional[str] = Query(None),  # pending, approved
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Spreadsheet-style view: images as rows, categories as columns.
    Returns annotations grouped by image with image-level pagination.
    """
    # Base query: only completed annotations
    base_q = db.query(Annotation).filter(Annotation.status == "completed")
    if annotator_id is not None:
        base_q = base_q.filter(Annotation.annotator_id == annotator_id)
    if review_status == "pending":
        base_q = base_q.filter(Annotation.review_status.is_(None))
    elif review_status == "approved":
        base_q = base_q.filter(Annotation.review_status == "approved")

    # Get distinct image IDs that have matching annotations, ordered by image_id
    image_ids_q = (
        base_q
        .with_entities(Annotation.image_id)
        .distinct()
        .order_by(Annotation.image_id)
    )
    all_image_ids = [row[0] for row in image_ids_q.all()]
    total_images = len(all_image_ids)

    # Paginate at image level
    start = (page - 1) * page_size
    page_image_ids = all_image_ids[start : start + page_size]

    # Fetch all completed annotations for this page of images (with eager loads)
    annotations = (
        db.query(Annotation)
        .filter(Annotation.status == "completed", Annotation.image_id.in_(page_image_ids))
        .options(
            joinedload(Annotation.image),
            joinedload(Annotation.annotator),
            joinedload(Annotation.category).joinedload(Category.options),
            joinedload(Annotation.selections),
        )
        .order_by(Annotation.image_id)
        .all()
    )

    # Apply filters again on the full set for this page
    # (we fetched ALL completed annotations for the images, need to re-apply annotator/status filters)
    filtered_annotations = annotations
    if annotator_id is not None:
        filtered_annotations = [a for a in filtered_annotations if a.annotator_id == annotator_id]
    if review_status == "pending":
        filtered_annotations = [a for a in filtered_annotations if a.review_status is None]
    elif review_status == "approved":
        filtered_annotations = [a for a in filtered_annotations if a.review_status == "approved"]

    # Group by image
    from collections import defaultdict
    image_map = {}  # image_id -> {image obj, annotations by category}
    for a in filtered_annotations:
        if a.image_id not in image_map:
            image_map[a.image_id] = {
                "image": a.image,
                "annotations": {},
            }

        # Build selected options
        selected_options = []
        for sel in a.selections:
            opt = db.query(Option).filter(Option.id == sel.option_id).first()
            if opt:
                selected_options.append({"id": opt.id, "label": opt.label})

        # All options in this category
        all_options = [
            {"id": o.id, "label": o.label, "is_typical": o.is_typical}
            for o in sorted(a.category.options, key=lambda x: x.display_order)
        ]

        image_map[a.image_id]["annotations"][str(a.category_id)] = ReviewTableCell(
            annotation_id=a.id,
            selected_options=selected_options,
            all_options=all_options,
            annotator_username=a.annotator.username,
            is_duplicate=a.is_duplicate,
            review_status=a.review_status,
        )

    # Build rows in the order of page_image_ids
    rows = []
    for img_id in page_image_ids:
        if img_id in image_map:
            entry = image_map[img_id]
            rows.append(ReviewTableRow(
                image_id=img_id,
                image_url=entry["image"].url,
                image_filename=entry["image"].filename,
                annotations=entry["annotations"],
            ))

    # All categories for column headers
    categories = db.query(Category).order_by(Category.display_order).all()
    cat_list = [ReviewTableCategory(id=c.id, name=c.name) for c in categories]

    return ReviewTableResponse(
        images=rows,
        categories=cat_list,
        total_images=total_images,
        page=page,
        page_size=page_size,
    )


@router.get("/review/stats")
def review_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Get review statistics."""
    total_completed = db.query(Annotation).filter(Annotation.status == "completed").count()
    pending = db.query(Annotation).filter(
        Annotation.status == "completed", Annotation.review_status.is_(None)
    ).count()
    approved = db.query(Annotation).filter(
        Annotation.status == "completed", Annotation.review_status == "approved"
    ).count()
    return {
        "total_completed": total_completed,
        "pending_review": pending,
        "approved": approved,
    }


@router.put("/review/{annotation_id}/approve")
def approve_annotation(
    annotation_id: int,
    payload: ReviewApproveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Approve an annotation as-is."""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    annotation.review_status = "approved"
    annotation.review_note = payload.review_note
    annotation.reviewed_by = admin.id
    annotation.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Annotation approved", "annotation_id": annotation_id}


@router.put("/review/{annotation_id}/update")
def update_and_approve_annotation(
    annotation_id: int,
    payload: ReviewUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin edits the selections and approves the annotation."""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Update selections
    db.query(AnnotationSelection).filter(
        AnnotationSelection.annotation_id == annotation.id
    ).delete()
    for option_id in payload.selected_option_ids:
        db.add(AnnotationSelection(annotation_id=annotation.id, option_id=option_id))

    # Update duplicate flag if provided
    if payload.is_duplicate is not None:
        annotation.is_duplicate = payload.is_duplicate

    # Mark as approved
    annotation.review_status = "approved"
    annotation.review_note = payload.review_note or "Edited by admin"
    annotation.reviewed_by = admin.id
    annotation.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Annotation updated and approved", "annotation_id": annotation_id}
