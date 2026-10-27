from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class PatientProgressRead(BaseModel):
    """Activity, measurement trends, and tracking quality for a patient."""

    patient_id: int

    # Overall activity across all recorded sessions.
    total_sessions: int
    total_repetitions: int
    total_duration_sec: int
    latest_session_at: datetime | None

    # Session tracking-quality distribution.
    good_tracking_sessions: int
    fair_tracking_sessions: int
    poor_tracking_sessions: int

    # Angle trends from the two most recent usable measurements.
    usable_angle_measurements: int
    latest_max_angle: float | None
    previous_max_angle: float | None
    max_angle_change: float | None
    latest_min_angle: float | None
    previous_min_angle: float | None
    min_angle_change: float | None

    # Pain trends from the two most recent sessions with pain reports.
    latest_reported_pain: int | None
    previous_reported_pain: int | None
    pain_change: int | None


class ReviewQueueItemRead(BaseModel):
    """Public API representation of a clinician review item."""

    id: int
    patient_id: int
    patient_name: str
    session_id: int | None
    reason_code: str
    reason: str
    status: str
    clinician_note: str | None
    created_at: datetime
    reviewed_at: datetime | None


class ReviewNoteCreate(BaseModel):
    """Validated request body for adding a clinician note."""

    note: str = Field(min_length=1, max_length=2000)

    @field_validator("note")
    @classmethod
    def validate_note(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Note cannot be empty or whitespace only.")
        return value


class LoginRequest(BaseModel):
    """Credentials submitted to the login endpoint."""

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()

        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("A valid email address is required.")

        return value


class PatientRegisterRequest(BaseModel):
    """Validated request body for public patient registration."""

    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=16, max_length=128)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Display name cannot be empty.")

        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()

        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("A valid email address is required.")

        return value


class TokenResponse(BaseModel):
    """Successful login response containing an access token."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthenticatedUserRead(BaseModel):
    """Safe public representation of the authenticated account."""

    id: int
    email: str
    role: Literal["patient", "clinician"]
    patient_id: int | None


class RegistrationResponse(BaseModel):
    """Successful registration response with a token and safe user details."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUserRead
