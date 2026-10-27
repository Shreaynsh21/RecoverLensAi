from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models import Patient, User
from app.schemas import (
    AuthenticatedUserRead,
    LoginRequest,
    PatientRegisterRequest,
    RegistrationResponse,
    TokenResponse,
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=RegistrationResponse, status_code=201)
def register_patient(
    payload: PatientRegisterRequest,
    session: Annotated[Session, Depends(get_session)],
) -> RegistrationResponse:
    """Register a patient and return a short-lived access token."""

    # Reject duplicate email addresses before creating any records.
    existing_user = session.exec(
        select(User.id).where(User.email == payload.email)
    ).first()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # New patients await clinician assignment and consent onboarding.
    patient = Patient(
        display_name=payload.display_name,
        pathway="Awaiting clinician assignment",
        consent_status="pending",
        is_synthetic=False,
    )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="patient",
        is_active=True,
    )

    try:
        # Create the patient profile and account in one transaction.
        session.add(patient)
        session.flush()

        user.patient_id = patient.id
        session.add(user)
        session.commit()
        session.refresh(user)

    except IntegrityError as exc:
        session.rollback()
        # Handles a duplicate email submitted concurrently.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    if user.id is None or user.patient_id is None:
        raise RuntimeError("Registration completed without the expected account IDs.")

    token = create_access_token(user.id, user.role)

    return RegistrationResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=AuthenticatedUserRead(
            id=user.id,
            email=user.email,
            role="patient",
            patient_id=user.patient_id,
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    """Authenticate an account and return a short-lived access token."""

    statement = select(User).where(User.email == payload.email)
    user = session.exec(statement).first()

    # Return the same error for unknown emails and incorrect passwords.
    if user is None or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user.id, user.role)

    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )
