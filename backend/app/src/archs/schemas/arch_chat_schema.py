from pydantic import BaseModel, Field
from typing import Optional


class CreateArchChat(BaseModel):
    question: str


class ArchChatResponse(BaseModel):
    id: str
    arch_id: str
    question: str
    answer: str
    created_at: str


class ArchChatListResponse(BaseModel):
    items: list[ArchChatResponse]
    total: int
    page: int
    limit: int
    pages: int
