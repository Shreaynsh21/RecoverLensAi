r"""Provision a clinician account locally; this is intentionally not an API route.

Run from services/api with the project's virtual environment and local .env loaded:
    .\.venv\Scripts\python.exe .\scripts\create_clinician.py

Clinician accounts should only be created for verified staff. Passwords are read
interactively and are never printed or written to a file.
"""

import re
from getpass import getpass

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.db import engine
from app.models import ClinicianPatientAssignment, Patient, User
from app.security import hash_password

PLACEHOLDER_PASSWORDS = {
    "replace_with_a_unique_demo_password",
    "replace_with_another_unique_demo_password",
    "passwordpassword1234",
}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def parse_patient_ids(raw_value: str) -> list[int]:
    """Parse optional comma-separated patient IDs without silently ignoring errors."""
    if not raw_value.strip():
        return []

    try:
        patient_ids = [int(part.strip()) for part in raw_value.split(",")]
    except ValueError as exc:
        raise ValueError(
            "Patient IDs must be comma-separated positive integers."
        ) from exc

    if any(patient_id <= 0 for patient_id in patient_ids):
        raise ValueError("Patient IDs must be positive integers.")
    if len(patient_ids) != len(set(patient_ids)):
        raise ValueError("A patient ID was entered more than once.")

    return patient_ids


def provision_clinician(
    session: Session,
    email: str,
    password: str,
    patient_ids: list[int] | None = None,
) -> User:
    """Create a clinician and optionally assign currently unassigned patients.

    This function never transfers an already-assigned patient from another
    clinician. It raises ValueError on validation/authorization conflicts.
    """
    normalized_email = email.strip().lower()
    patient_ids = patient_ids or []

    if not EMAIL_PATTERN.fullmatch(normalized_email) or len(normalized_email) > 255:
        raise ValueError("Enter a valid email address (maximum 255 characters).")
    if not 16 <= len(password) <= 128:
        raise ValueError("Password must contain between 16 and 128 characters.")
    if password in PLACEHOLDER_PASSWORDS:
        raise ValueError("Choose a non-placeholder password.")
    if len(patient_ids) != len(set(patient_ids)) or any(
        value <= 0 for value in patient_ids
    ):
        raise ValueError("Patient IDs must be unique positive integers.")

    existing_user = session.exec(
        select(User.id).where(User.email == normalized_email)
    ).first()
    if existing_user is not None:
        raise ValueError(
            "An account with this email already exists; no changes were made."
        )

    if patient_ids:
        found_ids = set(
            session.exec(select(Patient.id).where(Patient.id.in_(patient_ids))).all()
        )
        missing_ids = set(patient_ids) - found_ids
        if missing_ids:
            missing = ", ".join(str(value) for value in sorted(missing_ids))
            raise ValueError(
                f"Patient ID(s) not found: {missing}. No changes were made."
            )

        already_assigned = set(
            session.exec(
                select(ClinicianPatientAssignment.patient_id).where(
                    ClinicianPatientAssignment.patient_id.in_(patient_ids)
                )
            ).all()
        )
        if already_assigned:
            assigned = ", ".join(str(value) for value in sorted(already_assigned))
            raise ValueError(
                f"Patient ID(s) already assigned to a clinician: {assigned}. "
                "No assignments were changed."
            )

    clinician = User(
        email=normalized_email,
        password_hash=hash_password(password),
        role="clinician",
        patient_id=None,
        is_active=True,
    )
    session.add(clinician)
    session.flush()

    assignments = [
        ClinicianPatientAssignment(
            clinician_user_id=clinician.id,
            patient_id=patient_id,
        )
        for patient_id in patient_ids
    ]
    if assignments:
        session.add_all(assignments)

    session.commit()
    session.refresh(clinician)
    return clinician


def main() -> None:
    print("RecoverLens AI — local clinician account provisioning")
    print("Only provision accounts for verified, authorized clinical staff.\n")

    email = input("Clinician email: ").strip()
    password = getpass("New password (16–128 characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match. No changes were made.")

    raw_patient_ids = input(
        "Optional IDs of currently unassigned patients to assign (comma-separated; Enter for none): "
    )
    try:
        patient_ids = parse_patient_ids(raw_patient_ids)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    try:
        with Session(engine) as session:
            clinician = provision_clinician(
                session,
                email=email,
                password=password,
                patient_ids=patient_ids,
            )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    except IntegrityError as exc:
        raise SystemExit(
            "The database rejected the account or assignment. No partial changes were committed."
        ) from exc

    print("\nClinician account created successfully.")
    print(f"User ID: {clinician.id}")
    print(f"Email: {clinician.email}")
    print(f"Role: {clinician.role}")
    print(f"Patients assigned: {len(patient_ids)}")
    if not patient_ids:
        print(
            "No patients were assigned; the clinician dashboard will show an empty patient list."
        )


if __name__ == "__main__":
    main()
