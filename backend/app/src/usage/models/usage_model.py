from datetime import datetime, timezone
from beanie import Document
from pydantic import Field


class LLMUsage(Document):
    arch_id: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "llm_usage"
