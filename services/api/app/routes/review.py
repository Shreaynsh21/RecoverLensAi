from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlmodel import Session

from app.db import get_session
from app.models import Patient, ReviewItem
from app.schemas import ReviewNoteCreate, ReviewQueueItemRead

router = APIRouter(tags=["review queue"])


@router.get("/review-queue", response_model=list[ReviewQueueItemRead])
def list_review_queue(
    session: Annotated[Session, Depends(get_session)],
    status: Literal["pending", "reviewed", "dismissed"] = "pending",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[ReviewQueueItemRead]:
    """List clinician review items, newest first."""

    statement = (
        select(ReviewItem, Patient.display_name)
        .join(Patient, ReviewItem.patient_id == Patient.id)
        .where(ReviewItem.status == status)
        .order_by(ReviewItem.created_at.desc(), ReviewItem.id.desc())
        .offset(offset)
        .limit(limit)
    )

    rows = session.exec(statement).all()

    return [
        ReviewQueueItemRead(
            id=item.id,
            patient_id=item.patient_id,
            patient_name=patient_name,
            session_id=item.session_id,
            reason_code=item.reason_code,
            reason=item.reason,
            status=item.status,
            clinician_note=item.clinician_note,
            created_at=item.created_at,
            reviewed_at=item.reviewed_at,
        )
        for item, patient_name in rows
    ]

@router.post(
    "/review-queue/{review_id}/notes",
    response_model=ReviewQueueItemRead,
)
def add_review_note(
    review_id: int,
    payload: ReviewNoteCreate,
    session: Annotated[Session, Depends(get_session)],
) -> ReviewQueueItemRead:
    """Add a clinician note to an existing review item."""

    review_item = session.get(ReviewItem, review_id)

    if review_item is None:
        raise HTTPException(
            status_code=404,
            detail="Review item not found",
        )

    patient = session.get(Patient, review_item.patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient associated with review item not found",
        )

    review_item.clinician_note = payload.note
    session.add(review_item)
    session.commit()
    session.refresh(review_item)

    return ReviewQueueItemRead(
        id=review_item.id,
        patient_id=review_item.patient_id,
        patient_name=patient.display_name,
        session_id=review_item.session_id,
        reason_code=review_item.reason_code,
        reason=review_item.reason,
        status=review_item.status,
        clinician_note=review_item.clinician_note,
        created_at=review_item.created_at,
        reviewed_at=review_item.reviewed_at,
    )
