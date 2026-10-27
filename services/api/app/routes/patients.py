from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlmodel import Session

from app.db import get_session
from app.models import ExercisePlan, Patient, ReviewItem, SessionRecord, utc_now_naive
from app.schemas import (
    ExercisePlanRead,
    PatientListItem,
    PatientRead,
    SessionCreate,
    SessionRead,
)

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
            func.max(SessionRecord.started_at).label("last_session_at"),
        )
        .group_by(SessionRecord.patient_id)
        .subquery()
    )

    # One row per patient containing the number of pending reviews.
    pending_reviews = (
        select(
            ReviewItem.patient_id,
            func.count(ReviewItem.id).label("pending_review_count"),
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


@router.get(
    "/{patient_id}/exercise-plan",
    response_model=ExercisePlanRead,
)
def get_patient_exercise_plan(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
) -> ExercisePlanRead:
    """Retrieve the most recently created active exercise plan."""

    patient = session.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    statement = (
        select(ExercisePlan)
        .where(
            ExercisePlan.patient_id == patient_id,
            ExercisePlan.active.is_(True),
        )
        .order_by(
            ExercisePlan.created_at.desc(),
            ExercisePlan.id.desc(),
        )
        .limit(1)
    )

    exercise_plan = session.exec(statement).scalars().first()

    if exercise_plan is None:
        raise HTTPException(
            status_code=404,
            detail="No active exercise plan found",
        )

    return ExercisePlanRead.model_validate(exercise_plan)


@router.post(
    "/{patient_id}/sessions",
    response_model=SessionRead,
    status_code=201,
)
def create_patient_session(
    patient_id: int,
    payload: SessionCreate,
    session: Annotated[Session, Depends(get_session)],
) -> SessionRead:
    """Record an exercise session for a patient's active exercise plan."""

    patient = session.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    exercise_plan = session.get(ExercisePlan, payload.exercise_id)

    if (
        exercise_plan is None
        or exercise_plan.patient_id != patient_id
        or not exercise_plan.active
    ):
        raise HTTPException(
            status_code=404,
            detail="Active exercise plan not found for this patient",
        )

    # Require a timestamp with a timezone so the instant is unambiguous.
    if payload.started_at.tzinfo is None or payload.started_at.utcoffset() is None:
        raise HTTPException(
            status_code=422,
            detail="started_at must include a timezone",
        )

    started_at_utc = payload.started_at.astimezone(UTC)
    now_utc = datetime.now(UTC)

    if started_at_utc > now_utc:
        raise HTTPException(
            status_code=422,
            detail="started_at cannot be in the future",
        )

    # MySQL DATETIME stores a naive datetime; normalize to UTC first.
    started_at = started_at_utc.replace(tzinfo=None)

    if (
        payload.max_angle is not None
        and payload.min_angle is not None
        and payload.min_angle > payload.max_angle
    ):
        raise HTTPException(
            status_code=422,
            detail="min_angle cannot exceed max_angle",
        )

    record = SessionRecord(
        patient_id=patient_id,
        exercise_id=payload.exercise_id,
        started_at=started_at,
        duration_sec=payload.duration_sec,
        repetition_count=payload.repetition_count,
        max_angle=payload.max_angle,
        min_angle=payload.min_angle,
        tracking_quality=payload.tracking_quality,
        visibility_ratio=payload.visibility_ratio,
        patient_reported_pain=payload.patient_reported_pain,
        completion_status=payload.completion_status,
        created_at=utc_now_naive(),
    )

    session.add(record)
    session.commit()
    session.refresh(record)

    return SessionRead.model_validate(record)


@router.get(
    "/{patient_id}/sessions",
    response_model=list[SessionRead],
)
def list_patient_sessions(
    patient_id: int,
    session: Annotated[Session, Depends(get_session)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[SessionRead]:
    """List a patient's exercise sessions, newest first."""

    patient = session.get(Patient, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    statement = (
        select(SessionRecord)
        .where(SessionRecord.patient_id == patient_id)
        .order_by(
            SessionRecord.started_at.desc(),
            SessionRecord.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    records = session.exec(statement).scalars().all()

    return [
        SessionRead.model_validate(record)
        for record in records
    ]


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
