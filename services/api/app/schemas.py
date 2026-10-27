from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PatientRead(BaseModel):
    """Public API representation of a patient."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    pathway: str
    recovery_start: date | None
    clinician_name: str | None
    consent_status: str
    is_synthetic: bool
    created_at: datetime


class PatientListItem(PatientRead):
    """Patient profile plus dashboard summary fields."""

    last_session_at: datetime | None = None
    pending_review_count: int = 0


class ExercisePlanRead(BaseModel):
    """Public API representation of an exercise plan."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    name: str
    target_repetitions: int
    sessions_per_day: int
    start_max: float
    target_min: float
    instructions: str
    active: bool
    created_at: datetime


class SessionCreate(BaseModel):
    """Validated request body for recording an exercise session."""

    exercise_id: int = Field(gt=0)
    started_at: datetime
    duration_sec: int = Field(ge=0)
    repetition_count: int = Field(ge=0)

    max_angle: float | None = Field(default=None, ge=0, le=180)
    min_angle: float | None = Field(default=None, ge=0, le=180)

    tracking_quality: Literal["good", "fair", "poor"]
    visibility_ratio: float = Field(ge=0, le=1)

    patient_reported_pain: int | None = Field(
        default=None,
        ge=0,
        le=10,
    )

    completion_status: Literal["completed", "partial"]


class SessionRead(BaseModel):
    """Public API representation of a saved exercise session."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    exercise_id: int
    started_at: datetime
    duration_sec: int
    repetition_count: int
    max_angle: float | None
    min_angle: float | None
    tracking_quality: str
    visibility_ratio: float
    patient_reported_pain: int | None
    completion_status: str
    created_at: datetime
