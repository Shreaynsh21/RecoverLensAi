from datetime import UTC, date, datetime

from pydantic import NaiveDatetime
from sqlmodel import CheckConstraint, Field, SQLModel


def utc_now_naive() -> datetime:
    """Return the current UTC time as a naive datetime for MySQL DATETIME."""
    return datetime.now(UTC).replace(tzinfo=None)


class Patient(SQLModel, table=True):
    """A patient enrolled in the RecoverLens rehabilitation system."""

    __tablename__ = "patients"

    id: int | None = Field(default=None, primary_key=True)

    display_name: str = Field(max_length=120, index=True)
    pathway: str = Field(max_length=120)
    recovery_start: date | None = Field(default=None)

    clinician_name: str | None = Field(
        default=None,
        max_length=120,
    )

    # Synthetic records are for demonstrations only.
    consent_status: str = Field(
        default="synthetic",
        max_length=30,
    )
    is_synthetic: bool = Field(default=True)

    created_at: NaiveDatetime = Field(
        default_factory=utc_now_naive,
        nullable=False,
    )


class ExercisePlan(SQLModel, table=True):
    """An exercise plan prescribed for a particular patient."""

    __tablename__ = "exercise_plans"

    id: int | None = Field(default=None, primary_key=True)

    patient_id: int = Field(
        foreign_key="patients.id",
        index=True,
    )

    name: str = Field(max_length=120)
    target_repetitions: int = Field(ge=0)
    sessions_per_day: int = Field(ge=1)

    # These parameters must come from an approved exercise plan.
    start_max: float = Field(ge=0, le=180)
    target_min: float = Field(ge=0, le=180)

    instructions: str = Field(max_length=2000)
    active: bool = Field(default=True)

    created_at: NaiveDatetime = Field(
        default_factory=utc_now_naive,
        nullable=False,
    )


class SessionRecord(SQLModel, table=True):
    """Measurements saved after a patient exercise session."""

    __tablename__ = "session_records"

    id: int | None = Field(default=None, primary_key=True)

    patient_id: int = Field(
        foreign_key="patients.id",
        index=True,
    )

    # exercise_id identifies the patient's prescribed ExercisePlan.
    exercise_id: int = Field(
        foreign_key="exercise_plans.id",
        index=True,
    )

    started_at: NaiveDatetime = Field(index=True)
    duration_sec: int = Field(ge=0)
    repetition_count: int = Field(ge=0)

    # Measurements may be missing when tracking is unreliable.
    max_angle: float | None = Field(default=None, ge=0, le=180)
    min_angle: float | None = Field(default=None, ge=0, le=180)

    tracking_quality: str = Field(max_length=20)
    visibility_ratio: float = Field(ge=0, le=1)

    patient_reported_pain: int | None = Field(
        default=None,
        ge=0,
        le=10,
    )

    completion_status: str = Field(max_length=20)

    created_at: NaiveDatetime = Field(
        default_factory=utc_now_naive,
        nullable=False,
    )


class ReviewItem(SQLModel, table=True):
    """A session flag or missed-session item requiring review."""

    __tablename__ = "review_items"

    id: int | None = Field(default=None, primary_key=True)

    patient_id: int = Field(
        foreign_key="patients.id",
        index=True,
    )

    # Nullable because some review items may not relate to one session.
    session_id: int | None = Field(
        default=None,
        foreign_key="session_records.id",
        index=True,
    )

    reason_code: str = Field(max_length=64)
    reason: str = Field(max_length=500)

    status: str = Field(
        default="pending",
        max_length=20,
        index=True,
    )

    clinician_note: str | None = Field(
        default=None,
        max_length=2000,
    )

    created_at: NaiveDatetime = Field(
        default_factory=utc_now_naive,
        nullable=False,
    )

    reviewed_at: NaiveDatetime | None = Field(default=None)


class User(SQLModel, table=True):
    """An authenticated patient or clinician account."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('patient', 'clinician')",
            name="ck_users_role",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)

    email: str = Field(
        max_length=255,
        unique=True,
        index=True,
    )
    password_hash: str = Field(max_length=255)

    role: str = Field(max_length=20, index=True)

    # A patient account can link to one patient record.
    # Clinician accounts leave this field NULL.
    patient_id: int | None = Field(
        default=None,
        foreign_key="patients.id",
        unique=True,
        index=True,
    )

    is_active: bool = Field(default=True)

    created_at: NaiveDatetime = Field(
        default_factory=utc_now_naive,
        nullable=False,
    )


class ClinicianPatientAssignment(SQLModel, table=True):
    """Explicit authorization linking clinicians to assigned patients."""

    __tablename__ = "clinician_patient_assignments"

    clinician_user_id: int = Field(
        foreign_key="users.id",
        primary_key=True,
    )
    patient_id: int = Field(
        foreign_key="patients.id",
        primary_key=True,
    )

    created_at: NaiveDatetime = Field(
        default_factory=utc_now_naive,
        nullable=False,
    )
