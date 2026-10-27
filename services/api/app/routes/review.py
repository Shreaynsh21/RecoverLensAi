from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlmodel import Session

from app.db import get_session
from app.models import Patient, ReviewItem
from app.schemas import ReviewQueueItemRead

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
