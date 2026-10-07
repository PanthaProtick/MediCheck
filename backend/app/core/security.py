import secrets
from app.core.config import Settings
from app.core.errors import AppError
from app.models.schemas import StaffPrincipal

def require_staff(authorization: str | None, settings: Settings) -> StaffPrincipal:
    if not authorization:
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Missing authorization header.",
            fields=[],
        )
    
    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Invalid authorization header format.",
            fields=[],
        )
    
    token = parts[1]
    expected_token = settings.DEMO_STAFF_TOKEN
    if not expected_token or not secrets.compare_digest(token.encode("utf-8"), expected_token.encode("utf-8")):
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Invalid staff credential.",
            fields=[],
        )
    
    return StaffPrincipal(
        staff_id="STAFF-DEMO",
        pharmacy_id="PHARM-A",
        simulated=True,
    )
