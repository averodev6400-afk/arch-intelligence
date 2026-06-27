from datetime import datetime, timezone
from beanie import Document
from pydantic import Field


class ArchChat(Document):
    arch_id: str  # references the Arch document ID
    question: str
    answer: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "arch_chats"
