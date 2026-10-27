from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.db import get_session
from app.models import ClinicianPatientAssignment, User
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def authentication_error() -> HTTPException:
    """Return a consistent response for invalid authentication."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    """Validate a JWT and retrieve its current active account."""
    if credentials is None:
        raise authentication_error()

    try:
        claims = decode_access_token(credentials.credentials)
        subject = claims.get("sub")

        if not isinstance(subject, str) or not subject.isdecimal():
            raise authentication_error()

        user_id = int(subject)
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise authentication_error() from exc

    user = session.get(User, user_id)

    if user is None or not user.is_active:
        raise authentication_error()

    if user.role not in {"patient", "clinician"}:
        raise authentication_error()

    if user.role == "patient" and user.patient_id is None:
        raise authentication_error()

    return user


def require_clinician(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Require an authenticated clinician account."""
    if current_user.role != "clinician":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinician access required",
        )

    return current_user


def require_patient_access(
    patient_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    """Require ownership or an explicit clinician-patient assignment."""
    if current_user.role == "patient":
        if current_user.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access to this patient is not permitted",
            )

        return current_user

    assignment = session.get(
        ClinicianPatientAssignment,
        (current_user.id, patient_id),
    )

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this patient is not permitted",
        )

    return current_user
