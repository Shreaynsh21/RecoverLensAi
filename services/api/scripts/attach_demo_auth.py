"""Attach demo authentication accounts to existing synthetic demo data.

This is a one-time development bootstrap script, not a production
user-registration mechanism. It never deletes or recreates rehabilitation data.
"""

from sqlmodel import Session, select

from app.config import settings
from app.db import engine
from app.models import ClinicianPatientAssignment, Patient, User
from app.security import hash_password

EXPECTED_PATIENT_NAMES = {
    "Demo Patient A",
    "Demo Patient B",
    "Demo Patient C",
}

PLACEHOLDER_PASSWORDS = {
    "replace_with_a_unique_demo_password",
    "replace_with_another_unique_demo_password",
}


def attach_demo_auth() -> None:
    """Create demo login accounts and clinician assignments safely."""
    clinician_email = (settings.demo_clinician_email or "").strip().lower()
    patient_email = (settings.demo_patient_email or "").strip().lower()

    clinician_password = (
        settings.demo_clinician_password.get_secret_value()
        if settings.demo_clinician_password
        else ""
    )
    patient_password = (
        settings.demo_patient_password.get_secret_value()
        if settings.demo_patient_password
        else ""
    )

    if not clinician_email or not patient_email:
        raise RuntimeError("Configure both demo account emails in the local .env.")

    if any(
        "@" not in email or len(email) > 255 or any(c.isspace() for c in email)
        for email in (clinician_email, patient_email)
    ):
        raise RuntimeError("Demo account emails must be valid-looking email addresses.")

    if clinician_email == patient_email:
        raise RuntimeError("Demo clinician and patient emails must be different.")

    if any(
        not 16 <= len(password) <= 128 or password in PLACEHOLDER_PASSWORDS
        for password in (clinician_password, patient_password)
    ):
        raise RuntimeError(
            "Set two different, non-placeholder demo passwords "
            "between 16 and 128 characters in .env."
        )

    if clinician_password == patient_password:
        raise RuntimeError("Demo clinician and patient passwords must be different.")

    with Session(engine) as session:
        # Refuse to change authentication data if accounts already exist.
        if session.exec(select(User.id)).first() is not None:
            raise RuntimeError(
                "Seed aborted: users already exist. No changes were made."
            )

        if (
            session.exec(select(ClinicianPatientAssignment.clinician_user_id)).first()
            is not None
        ):
            raise RuntimeError(
                "Seed aborted: clinician assignments already exist. "
                "No changes were made."
            )

        # Confirm that the existing patient records are exactly the expected
        # synthetic demo records before linking accounts to them.
        patients = session.exec(select(Patient).order_by(Patient.id)).all()

        actual_names = {patient.display_name for patient in patients}

        if (
            len(patients) != 3
            or actual_names != EXPECTED_PATIENT_NAMES
            or not all(patient.is_synthetic for patient in patients)
        ):
            raise RuntimeError(
                "Seed aborted: expected exactly three synthetic demo patients. "
                "No changes were made."
            )

        patient_a = next(
            patient for patient in patients if patient.display_name == "Demo Patient A"
        )

        clinician_user = User(
            email=clinician_email,
            password_hash=hash_password(clinician_password),
            role="clinician",
            is_active=True,
        )

        patient_user = User(
            email=patient_email,
            password_hash=hash_password(patient_password),
            role="patient",
            patient_id=patient_a.id,
            is_active=True,
        )

        # Flush assigns IDs but does not commit the transaction.
        session.add_all([clinician_user, patient_user])
        session.flush()

        assignments = [
            ClinicianPatientAssignment(
                clinician_user_id=clinician_user.id,
                patient_id=patient.id,
            )
            for patient in patients
        ]
        session.add_all(assignments)

        # The two users and three assignments commit together.
        session.commit()

        print("Demo authentication setup completed.")
        print(
            {
                "users_created": 2,
                "clinician_patient_assignments_created": len(assignments),
                "patient_account_linked_to": "Demo Patient A",
                "existing_rehabilitation_records_modified": False,
            }
        )


if __name__ == "__main__":
    attach_demo_auth()
