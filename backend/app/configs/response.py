from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class SuccessResponse(BaseModel, Generic[T]):
    """
    Standard response model for successful API responses.
    """
    success: bool = True
    message: str
    data: Optional[T] = None

class ErrorResponse(BaseModel):
    """
    Standard response model for error API responses.
    """
    success: bool = False
    message: str
    error_code: str
    error: Optional[str] = None