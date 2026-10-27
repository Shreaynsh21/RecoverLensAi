from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


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