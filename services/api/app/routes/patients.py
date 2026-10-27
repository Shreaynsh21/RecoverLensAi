from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlmodel import Session

from app.db import get_session
from app.models import Patient, ReviewItem, SessionRecord
from app.schemas import PatientListItem, PatientRead

router = APIRouter(
    prefix="/patients",
    tags=["patients"],
)


@router.get("", response_model=list[PatientListItem])
def list_patients(
    session: Annotated[Session, Depends(get_session)],
) -> list[PatientListItem]:
    """List patients with their latest session and pending review count."""

    # One row per patient containing their latest session timestamp.
    latest_sessions = (
        select(
            SessionRecord.patient_id,
            func.max(SessionRecord.started_at).label(
                "last_session_at"
            ),
        )
        .group_by(SessionRecord.patient_id)
        .subquery()
    )

    # One row per patient containing the number of pending reviews.
    pending_reviews = (
        select(
            ReviewItem.patient_id,
            func.count(ReviewItem.id).label(
                "pending_review_count"
            ),
        )
        .where(ReviewItem.status == "pending")
        .group_by(ReviewItem.patient_id)
        .subquery()
    )

    # Outer joins ensure patients without sessions or reviews
    # still appear in the results.
    statement = (
        select(
            Patient,
            latest_sessions.c.last_session_at,
            func.coalesce(
                pending_reviews.c.pending_review_count,
                0,
            ).label("pending_review_count"),
        )
        .outerjoin(
            latest_sessions,
            latest_sessions.c.patient_id == Patient.id,
        )
        .outerjoin(
            pending_reviews,
            pending_reviews.c.patient_id == Patient.id,
        )
        .order_by(Patient.display_name, Patient.id)
    )

    rows = session.exec(statement).all()

    results: list[PatientListItem] = []

    for patient, last_session_at, pending_count in rows:
        data = patient.model_dump()
        data["last_session_at"] = last_session_at
        data["pending_review_count"] = int(pending_count)

        results.append(PatientListItem.model_validate(data))

    return results


@router.get("/{patient_id}", response_model=PatientRead)
def get_patient(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
) -> PatientRead:
    """Retrieve a single patient or return 404."""

    patient = session.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    return PatientRead.model_validate(patient)