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