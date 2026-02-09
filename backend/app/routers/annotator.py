from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from app.database import get_db
from app.dependencies import require_annotator
from app.models.user import User
from app.models.image import Image
from app.models.category import Category
from app.models.annotation import Annotation, AnnotationSelection
from app.models.annotator_category import AnnotatorCategory
from app.schemas.category import CategoryWithProgress
from app.schemas.annotation import AnnotationSave, AnnotationResponse, AnnotationTask

router = APIRouter(prefix="/annotator", tags=["Annotator"])


def _build_queue(db: Session, user_id: int, category_id: int) -> list[Image]:
    """
    Build the annotator's image queue for a category.

    The queue contains:
    1. Images this annotator has already touched (any status) — so they can go back
    2. Images NOT yet completed by ANY annotator for this category — the remaining work

    Images already completed by someone else (but not touched by this annotator)
    are excluded.

    Ordered by image.id for consistency.
    """
    all_images = db.query(Image).order_by(Image.id).all()

    # IDs of images this annotator has already annotated for this category
    my_annotation_image_ids = set(
        row.image_id
        for row in db.query(Annotation.image_id).filter(
            Annotation.annotator_id == user_id,
            Annotation.category_id == category_id,
        ).all()
    )

    # IDs of images completed by ANY annotator for this category
    completed_by_anyone_ids = set(
        row.image_id
        for row in db.query(Annotation.image_id).filter(
            Annotation.category_id == category_id,
            Annotation.status == "completed",
        ).all()
    )

    queue = []
    for img in all_images:
        if img.id in my_annotation_image_ids:
            # Annotator touched this — always include (for back navigation)
            queue.append(img)
        elif img.id not in completed_by_anyone_ids:
            # Not completed by anyone — still available
            queue.append(img)
        # else: completed by someone else, not touched by me — skip

    return queue


@router.get("/categories", response_model=list[CategoryWithProgress])
def my_categories(
    db: Session = Depends(get_db),
    user: User = Depends(require_annotator),
):
    """List categories assigned to the current annotator, with progress."""
    assignments = (
        db.query(AnnotatorCategory)
        .filter(AnnotatorCategory.user_id == user.id)
        .options(joinedload(AnnotatorCategory.category))
        .all()
    )
    total_images = db.query(Image).count()
    result = []
    for a in assignments:
        # Count images completed by ANYONE for this category
        completed_by_anyone = (
            db.query(Annotation.image_id)
            .filter(
                Annotation.category_id == a.category_id,
                Annotation.status == "completed",
            )
            .distinct()
            .count()
        )
        # Count images this annotator personally completed
        my_completed = (
            db.query(Annotation)
            .filter(
                Annotation.annotator_id == user.id,
                Annotation.category_id == a.category_id,
                Annotation.status == "completed",
            )
            .count()
        )
        my_skipped = (
            db.query(Annotation)
            .filter(
                Annotation.annotator_id == user.id,
                Annotation.category_id == a.category_id,
                Annotation.status == "skipped",
            )
            .count()
        )
        # Remaining = total - completed by anyone
        remaining = total_images - completed_by_anyone
        result.append(CategoryWithProgress(
            id=a.category.id,
            name=a.category.name,
            display_order=a.category.display_order,
            total_images=total_images,
            completed_images=completed_by_anyone,
            skipped_images=my_skipped,
        ))
    result.sort(key=lambda c: c.display_order)
    return result


@router.get("/categories/{category_id}/queue-size")
def get_queue_size(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_annotator),
):
    """Get the size of this annotator's queue for a category."""
    assignment = (
        db.query(AnnotatorCategory)
        .filter(
            AnnotatorCategory.user_id == user.id,
            AnnotatorCategory.category_id == category_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Category not assigned to you")
    queue = _build_queue(db, user.id, category_id)
    return {"queue_size": len(queue)}


@router.get("/categories/{category_id}/resume-index")
def resume_index(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_annotator),
):
    """Return the queue index where the annotator should resume work."""
    assignment = (
        db.query(AnnotatorCategory)
        .filter(
            AnnotatorCategory.user_id == user.id,
            AnnotatorCategory.category_id == category_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Category not assigned to you")

    queue = _build_queue(db, user.id, category_id)
    if not queue:
        return {"index": 0, "queue_size": 0}

    my_completed_ids = set(
        row.image_id
        for row in db.query(Annotation.image_id).filter(
            Annotation.annotator_id == user.id,
            Annotation.category_id == category_id,
            Annotation.status == "completed",
        ).all()
    )

    for i, img in enumerate(queue):
        if img.id not in my_completed_ids:
            return {"index": i, "queue_size": len(queue)}

    return {"index": len(queue) - 1, "queue_size": len(queue)}


@router.get("/categories/{category_id}/task/{queue_index}", response_model=AnnotationTask)
def get_annotation_task(
    category_id: int,
    queue_index: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_annotator),
):
    """
    Get a specific image (by queue index) for annotation in a given category.
    The queue only contains images available to this annotator (shared queue model).
    """
    # Verify assignment
    assignment = (
        db.query(AnnotatorCategory)
        .filter(
            AnnotatorCategory.user_id == user.id,
            AnnotatorCategory.category_id == category_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Category not assigned to you")

    # Build queue
    queue = _build_queue(db, user.id, category_id)
    total = len(queue)

    if total == 0:
        raise HTTPException(status_code=404, detail="No images available — all completed")

    if queue_index < 0 or queue_index >= total:
        raise HTTPException(status_code=404, detail="Queue index out of range")

    image = queue[queue_index]

    # Get category with options
    category = (
        db.query(Category)
        .options(joinedload(Category.options))
        .filter(Category.id == category_id)
        .first()
    )

    # Get existing annotation (this annotator's own)
    annotation = (
        db.query(Annotation)
        .filter(
            Annotation.image_id == image.id,
            Annotation.annotator_id == user.id,
            Annotation.category_id == category_id,
        )
        .first()
    )

    current = None
    if annotation:
        sel_ids = [s.option_id for s in annotation.selections]
        current = AnnotationResponse(
            id=annotation.id,
            image_id=annotation.image_id,
            annotator_id=annotation.annotator_id,
            category_id=annotation.category_id,
            is_duplicate=annotation.is_duplicate,
            status=annotation.status,
            review_status=annotation.review_status,
            review_note=annotation.review_note,
            selected_option_ids=sel_ids,
            created_at=annotation.created_at,
            updated_at=annotation.updated_at,
        )

    return AnnotationTask(
        image_id=image.id,
        image_url=image.url,
        image_filename=image.filename,
        category_id=category.id,
        category_name=category.name,
        options=[
            {"id": o.id, "label": o.label, "is_typical": o.is_typical}
            for o in category.options
        ],
        current_annotation=current,
        image_index=queue_index,
        total_images=total,
    )


@router.put("/categories/{category_id}/images/{image_id}/annotate", response_model=AnnotationResponse)
def save_annotation(
    category_id: int,
    image_id: int,
    payload: AnnotationSave,
    db: Session = Depends(get_db),
    user: User = Depends(require_annotator),
):
    """Save or update an annotation for a specific image + category."""
    # Verify assignment
    assignment = (
        db.query(AnnotatorCategory)
        .filter(
            AnnotatorCategory.user_id == user.id,
            AnnotatorCategory.category_id == category_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Category not assigned to you")

    # Verify image exists
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Upsert annotation
    annotation = (
        db.query(Annotation)
        .filter(
            Annotation.image_id == image_id,
            Annotation.annotator_id == user.id,
            Annotation.category_id == category_id,
        )
        .first()
    )

    if annotation:
        # Guard: never downgrade a completed annotation to skipped
        if annotation.status == "completed" and payload.status == "skipped":
            # Return the existing annotation unchanged
            option_ids = [
                s.option_id
                for s in db.query(AnnotationSelection)
                .filter(AnnotationSelection.annotation_id == annotation.id)
                .all()
            ]
            return AnnotationResponse(
                id=annotation.id,
                image_id=annotation.image_id,
                annotator_id=annotation.annotator_id,
                category_id=annotation.category_id,
                is_duplicate=annotation.is_duplicate,
                status=annotation.status,
                review_status=annotation.review_status,
                review_note=annotation.review_note,
                reviewed_by=annotation.reviewed_by,
                reviewed_at=annotation.reviewed_at,
                selected_option_ids=option_ids,
                created_at=annotation.created_at,
                updated_at=annotation.updated_at,
            )

        annotation.is_duplicate = payload.is_duplicate
        annotation.status = payload.status
        # Clear old selections
        db.query(AnnotationSelection).filter(
            AnnotationSelection.annotation_id == annotation.id
        ).delete()
    else:
        annotation = Annotation(
            image_id=image_id,
            annotator_id=user.id,
            category_id=category_id,
            is_duplicate=payload.is_duplicate,
            status=payload.status,
        )
        db.add(annotation)
        db.flush()  # get annotation.id

    # Add selections
    for option_id in payload.selected_option_ids:
        db.add(AnnotationSelection(annotation_id=annotation.id, option_id=option_id))

    db.commit()
    db.refresh(annotation)

    return AnnotationResponse(
        id=annotation.id,
        image_id=annotation.image_id,
        annotator_id=annotation.annotator_id,
        category_id=annotation.category_id,
        is_duplicate=annotation.is_duplicate,
        status=annotation.status,
        selected_option_ids=[s.option_id for s in annotation.selections],
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )
