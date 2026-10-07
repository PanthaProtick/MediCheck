from typing import Literal, Sequence
from app.models.schemas import ErrorDetail, ErrorResponse

ErrorCode = Literal[
    "validation_error", "unauthorized", "forbidden", "not_found",
    "immutable_conflict", "storage_unavailable", "internal_error",
    "method_not_allowed", "unsupported_media_type", "rate_limit_exceeded"
]

class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
        fields: Sequence[str] | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = list(fields or [])

    def to_response_dict(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "fields": self.fields,
            }
        }

    def to_error_response(self) -> ErrorResponse:
        return ErrorResponse(
            error=ErrorDetail(
                code=self.code,
                message=self.message,
                fields=self.fields,
            )
        )
